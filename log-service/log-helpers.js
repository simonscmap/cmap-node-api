const logHelper = (level) => (logInstance) => (arr) => {
  if (!logInstance ||
      typeof logInstance[level] !== 'function' ||
      !Array.isArray (arr)) {
    return;
  }

  arr.forEach (([message, dataObj]) => {
    let msg = message || 'undefined message';
    let data = dataObj || {};
    logInstance[level] (msg, data);
  });
};

module.exports = {
  logErrors: logHelper ('error'),
  logMessages: logHelper ('info'),
  logWarnings: logHelper ('warn'),
};
