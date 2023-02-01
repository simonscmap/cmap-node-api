const initializeLogger = require("../log-service");
const log = initializeLogger("errorHandling/generateError");

// Error mapping for queryHandler

const errorCodeMap = {
  ECANCEL: "Request cancelled.",
  EREQUEST: "",
};

const processRequestError = (error) => {
  let { number, originalError } = error;
  // capture the error message
  let msg = (originalError &&
             originalError.info &&
             originalError.info.message) ||
            (originalError &&
             originalError.message) ||
            '';

  if (number === 229) {
    // isolate the first quoted term
    let objectName = msg.slice(msg.indexOf('\'') + 1);
    objectName = objectName.slice(0, objectName.indexOf('\''));
    if (!objectName) {
      msg = 'An unknown error occurred';
    } else {
      // make the error message look like there is no such table in the db
      msg = `Invalid object name '${objectName}'`;
      log.info("masking permission error", { error, message: msg });
    }
    return msg;
  } else {
    return msg;
  }
};

module.exports = (errorObject) => {
  let err;

  switch (errorObject.code) {
    case "ECANCEL":
      err = "The request was cancelled";
      break;

    case "EREQUEST":
      err = processRequestError (errorObject);
      break;

    default:
      err = "An unknown error occured";
      break;
  }

  if (!err) {
    err = "An unknown error occured";
  }

  return err;
};
