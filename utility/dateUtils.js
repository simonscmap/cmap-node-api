const dayjs = require("dayjs");
const utc = require('dayjs/plugin/utc');

dayjs.extend(utc);


// toDateString :: String -> String
const toDateString = (d) => {
  const x = dayjs.utc (d);
  return x.format ('YYYY-MM-DD');
}

module.exports = {
  toDateString,
};
