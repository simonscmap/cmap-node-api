const fetch = require('isomorphic-fetch');
const Dropbox_ = require('dropbox').Dropbox;
const { getDatasetId } = require('../../queries/datasetId');
const directQuery = require('../../utility/directQuery');
const { safePath, safePathOr } = require('../../utility/objectUtils');
const initLog = require("../../log-service");

const moduleLogger = initLog ("controllers/dropbox");

// NOTE: this module is for accessing files in the vault, not the submissions app
// these require different dropbox access tokens
const dropbox = new Dropbox_({
  accessToken: process.env.DROPBOX_VAULT_TOKEN,
  fetch: fetch
});


const safePathOrEmpty = safePathOr ([]) ((val) => Array.isArray (val) && val.length > 0);


// return a share link to the correct folder given a shortName

// 1. get dataset id from short name
// 2. look up vault record by dataset id
// 3. vault folder contents and choose a path (rep, raw, nrt)
// 4. create share link
// 5. return share link and path

const getShareLinkController = async (req, res, next) => {
  const log = moduleLogger.setReqId(req.reqId);

  // 1.
  const shortName = req.params.shortName;

  if (!shortName) {
    log.warn ('no short name provided', { params: req.params });
    return res.sendStatus(400);
  }

  const datasetId = await getDatasetId(shortName, log);

  if (!datasetId) {
    log.error('no dataset id found for short name', { shortName });
    return res.sendStatus(404);
  }

  // 2.
  const qs = `select top 1 * from tblDataset_Vault where Dataset_ID=${datasetId};`;
  const [err, vaultResp] = await directQuery(qs, undefined, log);
  if (err) {
    log.error('error retrieving vault record', { shortName, datasetId, error: err });
    return res.sendStatus(500);
  }

  const result = safePath (['recordset', 0]) (vaultResp);
  if (!result) {
    log.error('no vault record found', { shortName, datasetId });
    return res.sendStatus(404);
  }


  // 3.
  const vaultPath = result.Vault_Path;
  const repPath = `/vault/${vaultPath}/rep`;
  const nrtPath = `/vault/${vaultPath}/nrt`;
  const rawPath = `/vault/${vaultPath}/raw`;

  const repResp = await dropbox.filesListFolder ({ path: repPath });
  const repContents = safePathOrEmpty (['entries']) (repResp);

  const nrtResult = await dropbox.filesListFolder ({ path: nrtPath });
  const nrtContents = safePathOrEmpty (['entries']) (nrtResp);

  const rawResp = await dropbox.filesListFolder ({ path: rawPath });
  const rawContents = safePathOrEmpty (['entries']) (rawResp);

  let folderName;
  let folderPath;
  if (repContents.length) {
    folderName = 'rep';
    folderPath = repPath;
  } else if (nrtContents.length) {
    folderName = 'nrt';
    folderPath = nrtPath;
  } else if (rawContents.length) {
    folderName = 'raw';
    folderPath = rawPath;
  } else {
    log.warn ('no dataset vault folders contain files', { vaultPath, shortName, datasetId })
    return res.sendStatus(404);
  }


  // 4. create share link
  let shareLink = '';
  // TODO generate share link

  // 5. return
  const payload = {
    shortName,
    datasetId,
    folderPath,
    folderName,
    shareLink,
    // TODO size metadata
  };
  return res.json(payload);
};


module.exports = {
  getShareLinkController
}
