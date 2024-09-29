const directQuery = require("../../utility/directQuery");
const initializeLogger = require("../../log-service");
const Future = require("fluture")
const { safePath } = require("../../utility/objectUtils");
const { sendServiceMail } = require("../../utility/email/sendMail");
const getNewsItem = require ("./getNewsItem");
const recipients = require ("./recipients");
const getTags = require("./getTags");
const insertEmail = require ("./insertEmail");
const insertRecipients = require("./insertRecipients");
const {
  renderGeneralNews,
  renderDatasetUpdate,
} = require("./preview");
const { monitor } = require("../../mail-service/checkBouncedMail");

const moduleLogger = initializeLogger("controllers/notifications/send");


const reSend = async (req, res) => {
  const log = moduleLogger.setReqId (req.requestId);
  const { emailId } = req.body;


  // 1. get history for email id

  // 2. identify failed recipients

  // 3. get prev sent email and resend to recipients

  // 4. record attempt / success

  // - (a) don't let monitor overwrite a success
  // - (b) increment #attempts and last attempt date
}
