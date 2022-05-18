const UnsafeUser = require("../../models/UnsafeUser");
const initializeLogger = require("../../log-service");
const log = initializeLogger("controllers/user/retrieveAPIKeys");

// Retrieve all API keys for a user
module.exports = async (req, res) => {
  let apiKeys;
  try {
    apiKeys = await UnsafeUser.getApiKeysByUserID(
      req.cmapApiCallDetails.userID
    );
  } catch (e) {
    log.error("error fetching api keys", {
      userId: req.cmapApiCallDetails.userID,
    });
  }
  return res.json({ keys: apiKeys });
};
