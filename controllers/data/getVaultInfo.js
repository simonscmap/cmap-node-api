const dbx = require('../../utility/DropboxVault');
const safePromise = require('../../utility/safePromise');
const { safePath } = require('../../utility/objectUtils');

const initLog = require('../../log-service');
const moduleLogger = initLog('controllers/dropbox/getVaultInfo');

const getFolderContents = async (
  path,
  aggregator = [],
  cursor,
  log = moduleLogger,
) => {
  // 1. prepare call
  // https://dropbox.github.io/dropbox-sdk-js/Dropbox.html#filesListFolder__anchor
  const arg = cursor
    ? { cursor }
    : {
        path,
        recursive: false,
        include_media_info: false,
        include_deleted: false,
        include_non_downloadable_files: false,
      };

  const method = cursor ? dbx.filesListFolderContinue : dbx.filesListFolder;

  // 2. make call
  // safePromise :: (promiseReturningFn, context) -> (args) -> [Err, Response]
  const [err, resp] = await safePromise(method, dbx)(arg);

  // 3. extract data
  const getResult = safePath(['result']);
  const result = getResult(resp);

  if (err || !result) {
    return [err || new Error('no result')];
  }

  // 4. recurse if necessary
  if (result.has_more) {
    // log.info ('dbx.filesListFolder has more: recursing', { path });
    return await getFolderContents(
      path,
      aggregator.concat(result.entries),
      result.cursor,
      log,
    );
  }

  // 5. return data
  const fullEntriesList = aggregator.concat(result.entries);
  log.info('dbx.filesListFolder complete', {
    path,
    fileCount: fullEntriesList.length,
  });
  return [null, fullEntriesList];
};

// parseByteSize :: Int -> [Int, String]
// return number in best denomination, and that denomination as string
// ref: https://stackoverflow.com/questions/15900485/correct-way-to-convert-size-in-bytes-to-kb-mb-gb-in-javascript
const parseByteSize = (bytes) => {
  if (!+bytes) {
    return [0, 'Bytes'];
  }

  const k = 1024;
  const sizes = [
    'Bytes',
    'KiB',
    'MiB',
    'GiB',
    'TiB',
    'PiB',
    'EiB',
    'ZiB',
    'YiB',
  ];

  const i = Math.floor(Math.log(bytes) / Math.log(k)); // denomination
  const x = parseFloat(bytes / Math.pow(k, i)); // convert bytes to denomination

  return [x, sizes[i]];
};

const getVaultFolderMetadata = async (folderPath, log) => {
  // 1. get folder contents
  const [lsfErr, entriesList] = await getFolderContents(
    folderPath,
    [],
    null,
    log,
  );
  if (lsfErr) {
    return [lsfErr];
  }

  // - get metadata for each item
  const aggregateSize = entriesList.reduce((agg, curr) => {
    return agg + curr.size;
  }, 0);

  const [size, denomination] = parseByteSize(aggregateSize);
  const sizeString = `${size.toFixed(2)} ${denomination}`;
  // - aggregate

  const payload = {
    sizeString,
    count: entriesList.length,
  };

  log.info('dbx getVaultMetadata complete', { path: folderPath, ...payload });

  return [null, payload];
};

module.exports = getVaultFolderMetadata;
