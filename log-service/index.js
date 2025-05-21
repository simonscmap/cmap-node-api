const { throttle } = require('throttle-debounce');
const { versions } = require('./get-versions');
const { id: workerId } = require('./get-worker');
const {
  head,
  filter,
  map,
  pipe,
  last,
  parseInt: parseInteger,
  chain,
  fromMaybe,
} = require('../utility/sanctuary');
const filterLogsForDevelopment = require('./filters');

// the development server will use 'staging' in order to enable news preview
const isProduction =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

const isDevelopment = process.env.NODE_ENV === 'development';

const DEBUG_USAGE = process.env.DEBUG_USAGE === 'enable';
const DEBUG_USAGE_THROTTLE_MS = parseInt(
  process.env.DEBUG_USAGE_THROTTLE_MS,
  10,
)
  ? parseInt(process.env.DEBUG_USAGE_THROTTLE_MS, 10)
  : 100;

let chalk;
if (isDevelopment) {
  chalk = require('chalk');
}

let includesLogLevel = (term) => term.includes('logLevel');
let includesLogFormat = (term) => term.includes('logFormat');
let split = (term) => term.split('=');

let logThresholdFromArgv = pipe([
  filter(includesLogLevel), // filter argv for one with "logLevel"
  head, // get the logLevel arg; head returns a Maybe
  map(split), // term should be logLevel=n
  chain(last), // get the part after '='; returns a Maybe, so we chain
  chain(parseInteger(10)), // parseInt retuns a maybe, so we chain
  fromMaybe(5), // default to the most inclusive threshold
]);

let logFormatFromArgv = pipe([
  filter(includesLogFormat),
  head, // get the logLevel arg; head returns a Maybe
  map(split), // term should be logFormat=value
  chain(last), // get the part after '='; returns a Maybe, so we chain
  fromMaybe('object'), // default to the most inclusive threshold
]);

const logThreshhold = logThresholdFromArgv(process.argv);
const logFormat = logFormatFromArgv(process.argv);

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

const throttledResourceUsageLog = throttle(DEBUG_USAGE_THROTTLE_MS, (args) => {
  const payload = {
    ...args,
    level: 3,
    error: false,
    data: {
      ...process.resourceUsage(),
      ...process.memoryUsage(),
    },
  };

  if (isProduction) {
    writeLogInProduction(payload);
  } else {
    writeLogInDevelopment(payload);
  }
});

function writeLogInProduction(payload) {
  payload.time = Date.now();

  // write log to stdout
  if (isProduction || logFormat === 'json') {
    console.log(JSON.stringify(payload));
    return;
  }
}

function writeLogInDevelopment(payload) {
  const shouldLog = filterLogsForDevelopment(payload);
  if (!shouldLog) {
    return;
  }
  if (logFormat === 'json') {
    console.log(JSON.stringify(payload));
    return;
  }
  const level = payload.level;

  const levelHeader = Object.entries(logLevel)
    .filter(([, val]) => val === level)
    .flat()
    .shift()
    .toUpperCase();

  const { module, ...ctx } = payload.context;
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
  };
  if (Object.keys(ctx).length) {
    abbreviatedPayload.context = ctx;
  }
  if (payload.data) {
    abbreviatedPayload.data = payload.data;
  }

  // log
  console.log(header);
  console.log(abbreviatedPayload);
}

function log(level, tags, context, message, isError, data) {
  // 0. exit if over the log threshhold

  if (isProduction && level > 3) {
    return;
  }
  if (isDevelopment && logThreshhold < level) {
    return;
  }

  // 1. ensure that log will have full context
  if (typeof level !== 'number') {
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

  if (context) {
    payload.context = context;
  }

  if (isError) {
    payload.error = true;
  }

  if (data) {
    // Properly serialize Error objects
    if (data instanceof Error) {
      payload.data = {
        message: data.message,
        stack: data.stack,
        name: data.name,
      };
    } else if (data.error instanceof Error) {
      payload.data = {
        ...data,
        error: {
          message: data.error.message,
          stack: data.error.stack,
          name: data.error.name,
        },
      };
    } else {
      payload.data = data;
    }
  }

  // 4. PRODUCTION write log to stdout
  if (isProduction) {
    payload.tags = tags;
    writeLogInProduction(payload);
    if (DEBUG_USAGE) {
      throttledResourceUsageLog({
        message: 'resource usage',
        context: {
          ...payload.context,
          originalMessage: payload.message,
        },
      });
    }
    return;
  }

  // 4. DEVELOPMENT write log
  if (isDevelopment) {
    writeLogInDevelopment(payload);
    if (DEBUG_USAGE) {
      throttledResourceUsageLog({
        message: 'resource usage',
        context: {
          ...payload.context,
          originalMessage: payload.message,
        },
      });
    }
    return;
  }
}

function createNewLogger(moduleName, extraContext = {}) {
  let { session, extra = [], requestId } = extraContext;

  let props = {
    tags: tagInfo,
    context: {
      module: moduleName,
    },
  };

  if (session) {
    props.context.session = session;
  }

  if (requestId) {
    props.context.requestId = requestId;
  }

  extra.forEach((ctxItem) => {
    if (Array.isArray(ctxItem) && ctxItem.length === 2) {
      let [k, v] = ctxItem;
      props.context[k] = v;
    }
  });

  let logger = Object.assign({}, props);

  // methods to set context info
  logger.setModule = (x) => {
    return createNewLogger(x, { ...extraContext });
  };

  logger.setSession = (x) => {
    return createNewLogger(moduleName, { ...extraContext, session: x });
  };

  logger.setReqId = (rid) => {
    return createNewLogger(moduleName, { ...extraContext, requestId: rid });
  };

  logger.addContext = (ctx) => {
    return createNewLogger(moduleName, {
      ...extraContext,
      extra: extra.concat([ctx]),
    });
  };

  // this method does not return a new logger
  logger.getReqId = () => extraContext.requestId;

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
        logger.data,
      );
    };
  });

  return logger;
}

module.exports = createNewLogger;
