const safePath = (path) => (obj) => {
  if (!Array.isArray(path)) {
    return undefined;
  }
  if (!path.every(item => typeof item === 'string')) {
    return undefined;
  }
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }

  // reduce down the path, starting with the full object as the accumulator
  // as soon as it cannot read a property it will start returning undefined
  const maybeValueAtPath = path.reduce ((acc, cur) => {
    if (!acc) {
      return acc;
    }
    let result;
    try {
      result = acc[cur];
    } catch (e) {
      console.log (`cannot read property ${cur} from ${acc}`);
    }
    return result;
  }, obj);

  return maybeValueAtPath;
}

module.exports = { safePath };
