const { versions } = require("./get-versions");
const { id: workerId } = require("./get-worker");
const {
  head,
  filter,
  map,
  pipe,
  last,
  parseInt: parseInteger,
  chain,
  fromMaybe
} = require("../utility/sanctuary");

// the development server will use 'staging' in order to enable news preview
const isProduction =
  process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging";

let includesLogLevel = (term) => term.includes("logLevel");
let split = (term) => term.split("=");

let logThresholdFromArgv = pipe([
  filter (includesLogLevel), // filter argv for one with "logLevel"
  head, // get the logLevel arg; head returns a Maybe
  map(split), // term should be logLevel=n
  chain (last), // get the part after '='; returns a Maybe, so we chain
  chain (parseInteger (10)), // parseInt retuns a maybe, so we chain
  fromMaybe (5) // default to the most inclusive threshold
]);

let logThreshhold = logThresholdFromArgv (process.argv);

const tagInfo = {
  versions: {
    api: versions.api,
    web: versions.web,
  },
  node_env: process.env.NODE_ENV,
};

if (workerId) {
  tagInfo.worker = workerId;
}

const logLevel = {
  trace: 5,
  debug: 4,
  info: 3,
  warn: 2,
  error: 1,
  fatal: 0,
};

function log(level, tags, context, message, isError, data) {
  // 0. exit if over the log threshhold

  if (isProduction && level > 3 || logThreshhold < level) {
    return;
  }

  // 1. ensure that log will have full context

  if (typeof level !== "number") {
    console.error('missing arg "level" in logger:');
    console.log(level);
    return;
  }

  if (!tags) {
    console.error('missing arg "tags" in logger:');
    console.log(tags);
    return;
  }

  if (!context) {
    console.error('missing arg "context" in logger:');
    console.log(context);
    return;
  }

  if (!message) {
    console.error('missing arg "message" in logger:');
    console.log(message);
    return;
  }


  // 3. prepare log
  let payload = {
    level,
    message,
  };

  // only log time and tags in production
  if (isProduction) {
    payload.time = Date.now();
    payload.tags = tags;
  }

  if (context) {
    payload.context = context;
  }

  if (isError) {
    payload.error = true;
  }

  if (data) {
    payload.data = data;
  }

  // 4. write log to stdout
  if (isProduction) {
    console.log(JSON.stringify(payload));
  } else {
    payload.time = new Date().toLocaleTimeString();
    console.log(payload);
  }
}

function createNewLogger(moduleName) {
  let logger = Object.assign(
    {},
    { tags: tagInfo, context: { module: moduleName } }
  );
  logger.setModule = (x) => {
    logger.context.module = x;
    return logger;
  };
  logger.setSession = (x) => {
    logger.context.session = x;
    return logger;
  };
  logger.addContext = function (ctx) {
    Object.assign(this.context, ctx);
    return logger;
  };

  Object.keys(logLevel).forEach((level) => {
    logger[level] = (content, additionalData) => {
      logger.level = logLevel[level];
      logger.message = content;
      logger.data = additionalData;
      if (level === "error" || level === "fatal") {
        logger.isError = true;
      }
      log(
        logLevel[level],
        logger.tags,
        logger.context,
        logger.message,
        logger.isError,
        logger.data
      );
    };
  });

  return logger;
}

module.exports = createNewLogger;
