// generate a key from a list of dataset short names
// for looking up recipient projections

// toLower
// default to empty string
const toLower = (str) => (str && str.toLowerCase)
      ? str.toLowerCase()
      : '';

// dedupe a list of keys
// default to empty array
const dedupe = (arr) => Array.isArray (arr)
      ? Array.from (new Set (arr))
      : [];

const generateKey = (tags) => {
  if (!Array.isArray (tags)) {
    return null;
  }

  const key = [tags]
        .map (item => item.map (toLower))
        .map (item => dedupe (item))
        .map (item => item.sort ())
        .map (item => item.join (' '))
        .shift ();



  if (key === "") {
    return 'empty'
  }

  return key;
}

module.exports = generateKey;
