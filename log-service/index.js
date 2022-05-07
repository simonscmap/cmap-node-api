const { versions } = require('./get-versions');
const { id: workerId } = require('./get-worker');

const isProduction = process.env.NODE_ENV === 'production';

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

  // 2. don't log trace or debug in production
  if (isProduction && level > 3) {
    return;
  }

  // 3. prepare log
  let payload = {
    level,
    message,
  };

  if (context) {
    payload.context = context;
  }

  if (isProduction) {
    time: Date.now(),
    payload.tags = tags;
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

function createNewLogger() {
  let logger = Object.assign({}, { tags: tagInfo, context: {} });
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
