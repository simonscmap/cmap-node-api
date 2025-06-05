// NOTE: this module is for accessing files in the vault, not the submissions app
// these require different dropbox credentials

const dbx = require('../../../utility/DropboxVault');
const { getDatasetId } = require('../../../queries/datasetId');
const directQuery = require('../../../utility/directQuery');
const { safePath, safePathOr } = require('../../../utility/objectUtils');
const initLog = require('../../../log-service');
const getVaultFolderMetadata = require('../getVaultInfo');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const os = require('os');
const archiver = require('archiver');
const { promisify } = require('util');
const mkdtemp = promisify(fs.mkdtemp);

const moduleLogger = initLog('controllers/data/dropbox-vault/vaultController');

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

// Function to recursively get all files in a folder including subfolders
const getFilesRecursively = async (path, log) => {
  const dropbox = dbx;

  // Helper function to handle pagination
  const listFolderContinue = async (files, cursor) => {
    try {
      const response = await dropbox.filesListFolderContinue({ cursor });

      // Process files from this batch
      const newFiles = response.result.entries
        .filter((entry) => entry['.tag'] === 'file')
        .map((file) => ({
          name: file.name,
          path: file.path_display,
          size: file.size,
          sizeFormatted: formatFileSize(file.size),
        }));

      const allFiles = [...files, ...newFiles];

      // If there are more files, continue pagination
      if (response.result.has_more) {
        return await listFolderContinue(allFiles, response.result.cursor);
      }

      return allFiles;
    } catch (error) {
      log.error('Error in pagination', { cursor, error });
      // Return files collected so far even if pagination fails
      return files;
    }
  };

  try {
    // Initial folder listing
    const listFolderResponse = await dropbox.filesListFolder({
      path,
      recursive: true,
      include_media_info: false,
      include_deleted: false,
      include_non_downloadable_files: false,
    });

    // Process files from initial response
    let files = listFolderResponse.result.entries
      .filter((entry) => entry['.tag'] === 'file')
      .map((file) => ({
        name: file.name,
        path: file.path_display,
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
      }));

    // If there are more files, handle pagination
    if (listFolderResponse.result.has_more) {
      files = await listFolderContinue(files, listFolderResponse.result.cursor);
    }

    return [null, files];
  } catch (error) {
    // Check if it's a "not found" error, which is fine (empty folder)
    if (
      error.status === 409 &&
      error.error.error_summary.includes('path/not_found')
    ) {
      log.info('Folder not found or empty', { path });
      return [null, []];
    }

    log.error('Error getting files recursively', { path, error });
    return [error, null];
  }
};

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (!+bytes) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

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
    listSharedLinksResp = await dropbox.sharingListSharedLinks(
      listSharedLinksArg,
    );
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

// New controller to get detailed file information for a dataset
const getVaultFilesInfo = async (req, res) => {
  const log = moduleLogger.setReqId(req.reqId);

  // Get the dataset short name from request
  const shortName = req.params.shortName;

  if (!shortName) {
    log.warn('No short name provided', { params: req.params });
    return res.status(400).json({ error: 'Dataset short name is required' });
  }

  // 1. Get dataset ID from short name
  const datasetId = await getDatasetId(shortName, log);

  if (!datasetId) {
    log.error('No dataset id found for short name', { shortName });
    return res.status(404).json({ error: 'Dataset not found' });
  }

  // 2. Get vault record for this dataset
  const qs = `select top 1 * from tblDataset_Vault where Dataset_ID=${datasetId};`;
  const [err, vaultResp] = await directQuery(qs, undefined, log);

  if (err) {
    log.error('Error retrieving vault record', {
      shortName,
      datasetId,
      error: err,
    });
    return res
      .status(500)
      .json({ error: 'Error retrieving vault information' });
  }

  const result = safePath(['recordset', 0])(vaultResp);
  if (!result) {
    log.error('No vault record found', { shortName, datasetId });
    return res.status(404).json({ error: 'No vault record found for dataset' });
  }

  // 3. Get file information from the vault folders
  const vaultPath = ensureTrailingSlash(result.Vault_Path);
  const repPath = `/vault/${vaultPath}rep`;
  const nrtPath = `/vault/${vaultPath}nrt`;
  const rawPath = `/vault/${vaultPath}raw`;

  // Get files from each folder
  const [repErr, repFiles] = await getFilesRecursively(repPath, log);
  const [nrtErr, nrtFiles] = await getFilesRecursively(nrtPath, log);
  const [rawErr, rawFiles] = await getFilesRecursively(rawPath, log);

  // Combine file information
  const filesByFolder = {
    rep: repErr ? [] : repFiles,
    nrt: nrtErr ? [] : nrtFiles,
    raw: rawErr ? [] : rawFiles,
  };

  // 4. Return the payload with file information
  const payload = {
    shortName,
    datasetId,
    files: filesByFolder,
    summary: {
      repCount: filesByFolder.rep.length,
      nrtCount: filesByFolder.nrt.length,
      rawCount: filesByFolder.raw.length,
      totalCount:
        filesByFolder.rep.length +
        filesByFolder.nrt.length +
        filesByFolder.raw.length,
    },
  };

  return res.json(payload);
};

const downloadDropboxVaultFiles = async (req, res) => {
  const log = moduleLogger.setReqId(req.reqId);
  const { shortName, datasetId, files } = req.body;
  log.info('downloadDropboxVaultFiles', { shortName, datasetId, files });

  if (!files || !Array.isArray(files) || files.length === 0) {
    log.warn('No files provided for download', { shortName, datasetId });
    return res.status(400).json({ error: 'No files provided for download' });
  }

  // Create a temporary directory to store the files

  let tempDir;
  try {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'cmap-vault-download-'));
    log.info('Created temporary directory', { tempDir });
  } catch (error) {
    log.error('Failed to create temporary directory', { error });
    return res.status(500).json({ error: 'Failed to prepare download' });
  }

  // Download each file from Dropbox
  const downloadPromises = files.map(async (file) => {
    const { path: filePath, name } = file;
    log.info('Downloading file', { filePath, name });

    try {
      // Download the file from Dropbox
      const response = await dbx.filesDownload({ path: filePath });

      // All files go directly in the temp directory
      const targetPath = path.join(tempDir, name);

      // Write the file to disk
      await fs.promises.writeFile(targetPath, response.result.fileBinary);

      log.info('File downloaded successfully', { filePath, targetPath });
      return { success: true, filePath, targetPath };
    } catch (error) {
      log.error('Failed to download file', { filePath, error });
      return { success: false, filePath, error };
    }
  });

  // Wait for all downloads to complete
  const downloadResults = await Promise.all(downloadPromises);

  // Check if any downloads failed
  const failedDownloads = downloadResults.filter((result) => !result.success);
  if (failedDownloads.length > 0) {
    log.warn('Some files failed to download', {
      failedCount: failedDownloads.length,
    });
  }

  // Create a zip file with all the downloaded files
  try {
    // Set the appropriate headers for file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${shortName}_vault_files.zip"`,
    );

    // Create a zip archive
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    // Pipe the archive to the response
    archive.pipe(res);

    // Get all files from the temp directory
    const files = await fs.promises.readdir(tempDir);

    // Add each file directly to the root of the archive
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      archive.file(filePath, { name: file }); // Use the filename as the name in the archive
    }

    // Finalize the archive
    await archive.finalize();

    log.info('Archive sent successfully', {
      shortName,
      fileCount: files.length,
    });

    // Clean up: Delete the temporary directory after response is sent
    fs.promises
      .rmdir(tempDir, { recursive: true })
      .then(() => log.info('Temporary directory cleaned up', { tempDir }))
      .catch((error) =>
        log.error('Failed to clean up temporary directory', { tempDir, error }),
      );

    return;
  } catch (error) {
    log.error('Failed to create zip archive', { error });
    return res.status(500).json({ error: 'Failed to create download archive' });
  }
};

module.exports = {
  getShareLinkController,
  getVaultFilesInfo,
  downloadDropboxVaultFiles,
};
