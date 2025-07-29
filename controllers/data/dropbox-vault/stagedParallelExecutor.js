// Staged parallel execution engine for Dropbox batch operations
const { setTimeout } = require('timers');
const { executeWithRetry } = require('./retryHelpers');
const BatchPerformanceLogger = require('./batchLogger');

// Utility function to chunk array into smaller arrays
const chunkArray = (array, chunkSize) => {
  // Debug logging
  console.log(`chunkArray called with chunkSize: ${chunkSize} (type: ${typeof chunkSize})`);
  
  // Improved infinity handling
  if (chunkSize === 'infinity' || 
      chunkSize === -1 || 
      String(chunkSize).toLowerCase() === 'infinity' || 
      chunkSize >= array.length) {
    console.log(`Creating single batch with ${array.length} files`);
    return [array]; // Single batch with all files
  }
  
  // Convert to number if string
  const numericChunkSize = typeof chunkSize === 'string' ? parseInt(chunkSize, 10) : chunkSize;
  
  if (isNaN(numericChunkSize) || numericChunkSize <= 0) {
    throw new Error(`Invalid chunk size: ${chunkSize}`);
  }
  
  const chunks = [];
  for (let i = 0; i < array.length; i += numericChunkSize) {
    chunks.push(array.slice(i, i + numericChunkSize));
  }
  
  console.log(`Created ${chunks.length} batches with chunk size ${numericChunkSize}`);
  return chunks;
};

// Execute a single batch with retry logic
const executeSingleBatch = async (batch, tempFolderPath, config, batchLogger, batchIndex, dbx) => {
  const copyEntries = batch.map((file) => ({
    from_path: file.filePath,
    to_path: `${tempFolderPath}/${file.name}`,
  }));

  batchLogger.logBatchStart(batchIndex, batch.length);

  try {
    const { result, retryCount } = await executeWithRetry(
      async () => {
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
                await new Promise(resolve => setTimeout(resolve, pollInterval));

                const checkResult = await dbx.filesCopyBatchCheckV2({
                  async_job_id: batchJobId,
                });

                if (checkResult.result['.tag'] === 'complete') {
                  return;
                } else if (checkResult.result['.tag'] === 'failed') {
                  throw new Error(`Batch copy failed: ${JSON.stringify(checkResult.result)}`);
                }
              }

              throw new Error('Batch copy operation timed out');
            },
            config,
            batchLogger,
            batchIndex,
            'batch-poll'
          );
          
          return { completed: true, batchJobId, pollRetryCount };
        }
        
        throw new Error(`Unexpected batch copy result: ${copyBatchResult.result['.tag']}`);
      },
      config,
      batchLogger,
      batchIndex,
      'batch-copy'
    );

    // Calculate total retry count (batch copy retries + poll retries if any)
    const totalRetryCount = retryCount + (result.pollRetryCount || 0);

    batchLogger.logBatchComplete(batchIndex, true, null, totalRetryCount);
    return result;
  } catch (error) {
    batchLogger.logBatchComplete(batchIndex, false, error, 0);
    throw error;
  }
};

// Execute staged parallel batches with fault tolerance
const executeStagedParallelBatches = async (files, tempFolderPath, config, baseLogger, dbx) => {
  const operationId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const batchLogger = new BatchPerformanceLogger(baseLogger, operationId);
  
  batchLogger.setConfig(config);
  
  // Create batches directly for parallel execution
  const filesPerBatch = Math.ceil(files.length / config.PARALLEL_BATCH_COUNT);
  const batches = chunkArray(files, filesPerBatch);
  const totalBatches = batches.length;
  
  batchLogger.setBatchCount(files.length, totalBatches);
  
  baseLogger.info('Starting fault-tolerant parallel batch execution', {
    operationId,
    totalFiles: files.length,
    totalBatches,
    filesPerBatch,
    config: config.name
  });
  
  const allErrors = [];
  
  // Calculate failure threshold
  const maxAllowableFailures = Math.floor(totalBatches * (config.MAX_FAILURE_RATE || 0.1));
  
  try {
    // CRITICAL FIX: Execute batches with fault tolerance - each promise NEVER rejects
    const batchPromises = batches.map((batch, batchIndex) => {
      return new Promise((batchResolve) => { // Note: Never rejects!
        const jitter = Math.random() * config.JITTER_MAX;
        const delay = (batchIndex * config.BATCH_STAGGER) + jitter;
        
        setTimeout(async () => {
          try {
            await executeSingleBatch(
              batch, 
              tempFolderPath, 
              config, 
              batchLogger, 
              batchIndex, 
              dbx
            );
            batchResolve({ success: true, batchIndex });
          } catch (error) {
            allErrors.push({ batchIndex, error });
            
            // Log failure but continue processing other batches
            baseLogger.warn(`Batch ${batchIndex} failed, continuing with remaining batches`, {
              error: error.message,
              failedBatches: allErrors.length,
              totalBatches,
              maxAllowable: maxAllowableFailures,
              config: config.name
            });
            
            // Always resolves (never rejects) so Promise.all continues
            batchResolve({ success: false, batchIndex, error });
          }
        }, delay);
      });
    });
    
    // SAFE: All promises resolve (never reject), so Promise.all won't fail-fast
    const results = await Promise.all(batchPromises);
    const successfulBatches = results.filter(r => r.success).length;
    const failedCount = allErrors.length;
    
    // Assess overall operation success based on failure threshold
    if (failedCount > maxAllowableFailures) {
      const errorSummary = `${failedCount} of ${totalBatches} batches failed (max allowable: ${maxAllowableFailures})`;
      batchLogger.logOperationComplete(false, new Error(errorSummary));
      throw new Error(`Batch operation failed: ${errorSummary}. First error: ${allErrors[0].error.message}`);
    } else if (failedCount > 0) {
      // Partial success - log warning but continue
      const successRate = ((totalBatches - failedCount) / totalBatches * 100).toFixed(1);
      baseLogger.warn(`Operation completed with partial success`, {
        successfulBatches,
        failedBatches: failedCount,
        totalBatches,
        successRate: successRate + '%',
        config: config.name
      });
    }
    
    batchLogger.logOperationComplete(true, null, { 
      successfulBatches, 
      failedBatches: failedCount,
      successRate: ((totalBatches - failedCount) / totalBatches * 100).toFixed(1) + '%'
    });
    
    baseLogger.info('Batch execution completed', {
      operationId,
      successfulBatches,
      failedBatches: failedCount,
      totalBatches,
      config: config.name
    });
    
  } catch (error) {
    batchLogger.logOperationComplete(false, error);
    throw error;
  }
};

module.exports = {
  executeStagedParallelBatches,
  chunkArray
};