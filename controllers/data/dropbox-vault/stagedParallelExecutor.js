// Staged parallel execution engine for Dropbox batch operations
const { setTimeout, clearTimeout } = require('timers');
const { executeWithRetry, isDropboxInternalError } = require('./retryHelpers');
const initLog = require('../../../log-service');
const moduleLogger = initLog(
  'controllers/data/dropbox-vault/stagedParallelExecutor',
);
// Utility function to chunk array into smaller arrays
const chunkArray = (array, chunkSize) => {
  if (
    chunkSize === 'infinity' ||
    chunkSize === -1 ||
    String(chunkSize).toLowerCase() === 'infinity' ||
    chunkSize >= array.length
  ) {
    return [array]; // Single batch with all files
  }

  // Convert to number if string
  const numericChunkSize =
    typeof chunkSize === 'string' ? parseInt(chunkSize, 10) : chunkSize;

  if (isNaN(numericChunkSize) || numericChunkSize <= 0) {
    throw new Error(`Invalid chunk size: ${chunkSize}`);
  }

  const chunks = [];
  for (let i = 0; i < array.length; i += numericChunkSize) {
    chunks.push(array.slice(i, i + numericChunkSize));
  }

  return chunks;
};

// Execute a single batch with retry logic
const executeSingleBatch = async (
  batch,
  tempFolderPath,
  config,
  log,
  batchIndex,
  dbx,
  abortSignal,
) => {
  const copyEntries = batch.map((file) => ({
    from_path: file.filePath,
    to_path: `${tempFolderPath}/${file.name}`,
  }));

  log.info('Starting batch execution', {
    batchIndex,
    fileCount: batch.length,
    tempFolderPath,
  });

  try {
    const { result, retryCount } = await executeWithRetry(
      async () => {
        // Check abort signal before making API call
        if (abortSignal && abortSignal.aborted) {
          throw new Error(
            'Operation aborted due to internal error in another batch',
          );
        }

        // Execute batch copy
        const copyBatchResult = await dbx.filesCopyBatchV2({
          entries: copyEntries,
          autorename: true,
        });

        // Handle immediate completion
        if (copyBatchResult.result['.tag'] === 'complete') {
          return { completed: true };
        }

        // Handle async job
        if (copyBatchResult.result['.tag'] === 'async_job_id') {
          const batchJobId = copyBatchResult.result.async_job_id;

          // Wait for completion with timeout
          const { retryCount: pollRetryCount } = await executeWithRetry(
            async () => {
              const maxWaitTime = config.BATCH_TIMEOUT;
              const pollInterval = config.POLL_INTERVAL;
              const startTime = Date.now();

              while (Date.now() - startTime < maxWaitTime) {
                // Check abort signal during polling
                if (abortSignal && abortSignal.aborted) {
                  throw new Error(
                    'Operation aborted due to internal error in another batch',
                  );
                }

                await new Promise((resolve) =>
                  setTimeout(resolve, pollInterval),
                );

                const checkResult = await dbx.filesCopyBatchCheckV2({
                  async_job_id: batchJobId,
                });

                if (checkResult.result['.tag'] === 'complete') {
                  return;
                } else if (checkResult.result['.tag'] === 'failed') {
                  throw new Error(
                    `Batch copy failed: ${JSON.stringify(checkResult.result)}`,
                  );
                }
              }

              throw new Error('Batch copy operation timed out');
            },
            config,
            batchIndex,
            'batch-poll',
          );

          return { completed: true, batchJobId, pollRetryCount };
        }

        throw new Error(
          `Unexpected batch copy result: ${copyBatchResult.result['.tag']}`,
        );
      },
      config,
      batchIndex,
      'batch-copy',
    );

    log.info('Batch execution completed successfully', {
      batchIndex,
      fileCount: batch.length,
      retryCount,
    });
    return result;
  } catch (error) {
    log.error('Batch execution failed', {
      batchIndex,
      fileCount: batch.length,
      error: error.message,
    });
    throw error;
  }
};

// Execute staged parallel batches with fault tolerance
const executeStagedParallelBatches = async (
  files,
  tempFolderPath,
  config,
  dbx,
) => {
  const operationId = `batch-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 8)}`;
  const log = moduleLogger.setReqId(operationId);

  log.info('Starting staged parallel batch execution', {
    operationId,
    totalFiles: files.length,
    tempFolderPath,
    configName: config.name || 'unknown',
    parallelBatchCount: config.PARALLEL_BATCH_COUNT,
  });

  // Create batches directly for parallel execution
  const filesPerBatch = Math.ceil(files.length / config.PARALLEL_BATCH_COUNT);
  const batches = chunkArray(files, filesPerBatch);
  const totalBatches = batches.length;

  log.info('Batch configuration calculated', {
    totalBatches,
    filesPerBatch,
    maxAllowableFailures: Math.floor(
      totalBatches * (config.MAX_FAILURE_RATE || 0.1),
    ),
  });

  const allErrors = [];

  // Calculate failure threshold
  const maxAllowableFailures = Math.floor(
    totalBatches * (config.MAX_FAILURE_RATE || 0.1),
  );

  // Shared abort signal for cancelling remaining batches
  const abortSignal = { aborted: false };
  const pendingTimeouts = [];

  try {
    // CRITICAL FIX: Execute batches with fault tolerance - each promise NEVER rejects
    const batchPromises = batches.map((batch, batchIndex) => {
      return new Promise((batchResolve) => {
        // Note: Never rejects!
        const jitter = Math.random() * config.JITTER_MAX;
        const delay = batchIndex * config.BATCH_STAGGER + jitter;

        const timeoutId = setTimeout(async () => {
          // Check if operation has been aborted before starting
          if (abortSignal.aborted) {
            batchResolve({ success: false, batchIndex, aborted: true });
            return;
          }
          try {
            // Double-check abort flag right before execution
            if (abortSignal.aborted) {
              batchResolve({ success: false, batchIndex, aborted: true });
              return;
            }

            await executeSingleBatch(
              batch,
              tempFolderPath,
              config,
              log,
              batchIndex,
              dbx,
              abortSignal,
            );
            log.info('Batch completed successfully', { batchIndex });
            batchResolve({ success: true, batchIndex });
          } catch (error) {
            allErrors.push({ batchIndex, error });
            log.error('Batch failed during execution', {
              batchIndex,
              error: error.message,
              isDropboxInternalError: isDropboxInternalError(error),
            });

            // Check for Dropbox internal_error - abort entire operation immediately
            if (isDropboxInternalError(error)) {
              log.error(
                'Dropbox internal error detected - aborting all remaining batches',
                {
                  batchIndex,
                  error: error.message,
                },
              );
              abortSignal.aborted = true; // Signal all other batches to abort

              // Resolve with fatal error flag to signal immediate abort
              batchResolve({
                success: false,
                batchIndex,
                error,
                fatalError: true,
              });
              return;
            }

            // Always resolves (never rejects) so Promise.all continues
            batchResolve({ success: false, batchIndex, error });
          }
        }, delay);

        pendingTimeouts.push(timeoutId);
      });
    });

    // SAFE: All promises resolve (never reject), so Promise.all won't fail-fast
    const results = await Promise.all(batchPromises);

    // Check for any fatal errors (like Dropbox internal_error)
    const fatalError = results.find((r) => r.fatalError);
    if (fatalError) {
      log.error('Operation aborted due to fatal error', {
        fatalBatchIndex: fatalError.batchIndex,
        fatalError: fatalError.error.message,
      });
      throw new Error(
        `Operation aborted due to Dropbox internal_error in batch ${fatalError.batchIndex}: ${fatalError.error.message}`,
      );
    }

    const failedCount = allErrors.length;
    const successCount = totalBatches - failedCount;

    log.info('Batch execution results', {
      totalBatches,
      successCount,
      failedCount,
      maxAllowableFailures,
    });

    // Assess overall operation success based on failure threshold
    if (failedCount > maxAllowableFailures) {
      const errorSummary = `${failedCount} of ${totalBatches} batches failed (max allowable: ${maxAllowableFailures})`;
      log.error('Operation failed - too many batch failures', {
        failedCount,
        totalBatches,
        maxAllowableFailures,
        firstError: allErrors[0]?.error.message,
      });
      throw new Error(
        `Batch operation failed: ${errorSummary}. First error: ${allErrors[0].error.message}`,
      );
    } else if (failedCount > 0) {
      // Partial success - log warning but continue
      log.warn(
        'Operation completed with some batch failures within tolerance',
        {
          failedCount,
          totalBatches,
          maxAllowableFailures,
        },
      );
    } else {
      log.info('All batches completed successfully', {
        totalBatches,
        totalFiles: files.length,
      });
    }
  } catch (error) {
    log.error('Staged parallel batch execution failed', {
      operationId,
      totalFiles: files.length,
      totalBatches,
      error: error.message,
    });
    throw error;
  } finally {
    // Clear any pending timeouts
    pendingTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    log.info('Staged parallel batch execution completed', {
      operationId,
      pendingTimeoutsCleared: pendingTimeouts.length,
    });
  }
};

module.exports = {
  executeStagedParallelBatches,
  chunkArray,
};
