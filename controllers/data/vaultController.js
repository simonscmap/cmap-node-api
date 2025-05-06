// NOTE: this module is for accessing files in the vault, not the submissions app
// these require different dropbox credentials

const dbx = require('../../utility/DropboxVault');
const { getDatasetId } = require('../../queries/datasetId');
const directQuery = require('../../utility/directQuery');
const { safePath, safePathOr } = require('../../utility/objectUtils');
const initLog = require('../../log-service');
const getVaultFolderMetadata = require('./getVaultInfo');
const { URL } = require('url');

const moduleLogger = initLog('controllers/dropbox');

const safePathOrEmpty = safePathOr([])(
  (val) => Array.isArray(val) && val.length > 0,
);

const ensureTrailingSlash = (path = '') => {
  if (path.length === 0) {
    return path;
  } else if (path.charAt(path.length - 1) !== '/') {
    return `${path}/`;
  } else {
    return path;
  }
};
function forceDropboxFolderDownload(dropboxLink) {
  const url = new URL(dropboxLink);
  url.searchParams.set('dl', '1');
  return url.toString();
}

// vaultController: return a share link to the correct folder given a shortName

// 1. get dataset id from short name
// 2. look up vault record by dataset id
// 3. vault folder contents and choose a path (rep, raw, nrt)
// 4. create share link
// 5. get metadata
// 6. return payload

const getShareLinkController = async (req, res) => {
  const log = moduleLogger.setReqId(req.reqId);

  // 0.
  const dropbox = dbx;

  // 1.
  const shortName = req.params.shortName;

  if (!shortName) {
    log.warn('no short name provided', { params: req.params });
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
    log.error('error retrieving vault record', {
      shortName,
      datasetId,
      error: err,
    });
    return res.sendStatus(500);
  }

  const result = safePath(['recordset', 0])(vaultResp);
  if (!result) {
    log.error('no vault record found', { shortName, datasetId });
    return res.sendStatus(404);
  }

  // 3.
  log.info('retrieved valut info', result);
  const vaultPath = ensureTrailingSlash(result.Vault_Path);
  const repPath = `/vault/${vaultPath}rep`;
  const nrtPath = `/vault/${vaultPath}nrt`;
  const rawPath = `/vault/${vaultPath}raw`;

  let repResp;
  try {
    repResp = await dropbox.filesListFolder({ path: repPath });
  } catch (e) {
    log.error('dropbox error: filesListFolder', {
      path: repPath,
      error: e.error,
      status: e.status,
    });
    return res.sendStatus(500);
  }
  const repContents = safePathOrEmpty(['result', 'entries'])(repResp);

  let nrtResp;
  try {
    nrtResp = await dropbox.filesListFolder({ path: nrtPath });
  } catch (e) {
    log.error('dropbox error: filesListFolder', {
      path: nrtPath,
      error: e.error,
      status: e.status,
    });
    return res.sendStatus(500);
  }
  const nrtContents = safePathOrEmpty(['result', 'entries'])(nrtResp);

  let rawResp;
  try {
    rawResp = await dropbox.filesListFolder({ path: rawPath });
  } catch (e) {
    log.error('dropbox error: filedListFolder', {
      path: rawPath,
      error: e.error,
      status: e.status,
    });
    return res.sendStatus(500);
  }
  const rawContents = safePathOrEmpty(['result', 'entries'])(rawResp);

  let folderName;
  let folderPath;
  if (repContents.length) {
    folderName = 'rep';
    folderPath = repPath;
    console.log(repContents[0]);
  } else if (nrtContents.length) {
    folderName = 'nrt';
    folderPath = nrtPath;
    console.log(nrtContents[0]);
  } else if (rawContents.length) {
    folderName = 'raw';
    folderPath = rawPath;
    console.log(rawContents[0]);
  } else {
    log.warn('no dataset vault folders contain files', {
      vaultPath,
      shortName,
      datasetId,
    });
    return res.sendStatus(404);
  }

  // 4. get share link

  // 4. a) check if link already exists

  const listSharedLinksArg = { path: folderPath, direct_only: true };
  let listSharedLinksResp;
  try {
    listSharedLinksResp =
      await dropbox.sharingListSharedLinks(listSharedLinksArg);
  } catch (e) {
    log.error('dropbox error: listSharedLinks', {
      ...listSharedLinksArg,
      error: e.error,
      status: e.status,
    });
    return res.sendStatus(500);
  }

  let link = safePath(['result', 'links', 0, 'url'])(listSharedLinksResp);

  if (link) {
    link = forceDropboxFolderDownload(link);
    log.info('retrieved existing dropbox share link', {
      path: folderPath,
      url: link,
    });
  } else {
    // 4. b) if no existing link, create one
    const arg = {
      path: folderPath,
      settings: {
        require_password: false,
        expires: undefined, // does not expire
        allow_download: true,
      },
    };

    let shareLinkResp;
    try {
      shareLinkResp = await dropbox.sharingCreateSharedLinkWithSettings(arg);
    } catch (e) {
      log.error('dropbox error: sharingCreateSharedLinkWithSettings', arg);
      console.log(e);
      return res.sendStatus(500);
    }

    const newShareLink = safePath(['result', 'url'])(shareLinkResp);

    if (!newShareLink) {
      log.error('no new share link returned', {
        path: folderPath,
        resp: shareLinkResp,
      });
      return res.sendStatus(500);
    }

    link = forceDropboxFolderDownload(newShareLink);
  }

  // 5. metadata
  const [mdErr, metadata] = await getVaultFolderMetadata(folderPath, log);
  if (mdErr) {
    res.status(500).send('error retrieving metadata');
  }

  // 6. return
  const payload = {
    shortName,
    datasetId,
    folderPath,
    folderName,
    shareLink: link,
    metadata: {
      totalSize: metadata.sizeString,
      fileCount: metadata.count,
    },
  };

  return res.json(payload);
};

module.exports = {
  getShareLinkController,
};
