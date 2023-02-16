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

const isDevelopment = process.env.NODE_ENV === 'development';

let chalk;
if (isDevelopment) {
  chalk = require('chalk');
}

let includesLogLevel = (term) => term.includes("logLevel");
let includesLogFormat = (term) => term.includes("logFormat");
let split = (term) => term.split("=");

let logThresholdFromArgv = pipe([
  filter (includesLogLevel), // filter argv for one with "logLevel"
  head, // get the logLevel arg; head returns a Maybe
  map(split), // term should be logLevel=n
  chain (last), // get the part after '='; returns a Maybe, so we chain
  chain (parseInteger (10)), // parseInt retuns a maybe, so we chain
  fromMaybe (5) // default to the most inclusive threshold
]);

let logFormatFromArgv = pipe([
  filter (includesLogFormat),
  head, // get the logLevel arg; head returns a Maybe
  map (split), // term should be logFormat=value
  chain (last), // get the part after '='; returns a Maybe, so we chain
  fromMaybe ("object") // default to the most inclusive threshold
]);

let logThreshhold = logThresholdFromArgv (process.argv);
let logFormat = logFormatFromArgv (process.argv);

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
  if (isProduction || logFormat === "json") {
    console.log(JSON.stringify(payload));
    return;
  }

  if (isDevelopment) {
    let levelHeader = Object.entries(logLevel)
                            .filter(([, val]) => val === level)
                            .flat()
                            .shift()
                            .toUpperCase()

    let { module, ...ctx } = payload.context;
    let header;
    switch (levelHeader) {
      case 'ERROR':
        header = chalk`\n{red ${level}} - {red.bold ${levelHeader}} in {blueBright ${module}}`;
        break;
      case 'WARN':
        header = chalk`\n{magenta ${level}} - {magenta ${levelHeader}} in {blueBright ${module}}`;
        break;
      case 'INFO':
        header = chalk`\n{green ${level}} - {green ${levelHeader}} in {blueBright ${module}}`;
        break;
      case 'DEBUG':
        header = chalk`\n{yellow ${level}} - {yellow ${levelHeader}} in {blueBright ${module}}`;
        break;
      default:
       // trace
       header = chalk`\n{blackBright ${level} - ${levelHeader} in} {blueBright ${module}}`;
    }

    let abbreviatedPayload = {
      message: payload.message,
    }
    if (Object.keys(ctx).length) {
      abbreviatedPayload.context = ctx;
    }
    if (payload.data) {
      abbreviatedPayload.data = payload.data;
    }
    console.log(header);
    console.log(abbreviatedPayload);
  }
}

function createNewLogger(moduleName, extraContext = {}) {
  let { session, extra = [], requestId } = extraContext;

  let props = {
    tags: tagInfo,
    context: {
      module: moduleName
    }
  };

  if (session) {
    props.context.session = session;
  }

  if (requestId) {
    props.context.requestId = requestId;
  }

  extra.forEach ((ctxItem) => {
    if (Array.isArray(ctxItem) && ctxItem.length === 2) {
      let [k, v] = ctxItem;
      props.context[k] = v;
    }
  });


  let logger = Object.assign({}, props);

  // methods to set context info
  logger.setModule = (x) => {
    return createNewLogger (x, {...extraContext});
  };

  logger.setSession = (x) => {
    return createNewLogger (moduleName, { ...extraContext, session: x });
  };

  logger.setReqId = (rid) => {
    return createNewLogger (moduleName, { ...extraContext, requestId: rid });
  };

  logger.addContext = (ctx) => {
    return createNewLogger (moduleName, { ...extraContext, extra: extra.concat([ctx])});
  };

  Object.keys(logLevel).forEach((level) => {
    logger[level] = (content, additionalData) => {
      logger.level = logLevel[level];
      logger.message = content;
      logger.data = additionalData;
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
