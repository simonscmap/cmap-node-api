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

  batchLogger.logBatchStart(batchIndex, batch.length, Math.floor(batchIndex / config.PARALLEL_COUNT));

  try {
    const result = await executeWithRetry(
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
          await executeWithRetry(
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
          
          return { completed: true, batchJobId };
        }
        
        throw new Error(`Unexpected batch copy result: ${copyBatchResult.result['.tag']}`);
      },
      config,
      batchLogger,
      batchIndex,
      'batch-copy'
    );

    batchLogger.logBatchComplete(batchIndex, true);
    return result;
  } catch (error) {
    batchLogger.logBatchComplete(batchIndex, false, error);
    throw error;
  }
};

// Execute staged parallel batches
const executeStagedParallelBatches = async (files, tempFolderPath, config, baseLogger, dbx) => {
  const operationId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const batchLogger = new BatchPerformanceLogger(baseLogger, operationId);
  
  batchLogger.setConfig(config);
  
  // Split files directly between PARALLEL_COUNT to create single wave
  const filesPerBatch = Math.ceil(files.length / config.PARALLEL_COUNT);
  const allBatches = chunkArray(files, filesPerBatch);
  const totalBatches = allBatches.length;
  
  batchLogger.setBatchCount(files.length, totalBatches);
  
  baseLogger.info('Starting staged parallel execution', {
    operationId,
    totalFiles: files.length,
    totalBatches,
    filesPerBatch,
    config: config.name
  });
  
  // All batches fit in a single wave since we split by PARALLEL_COUNT
  const waves = [allBatches];
  
  let batchIndex = 0;
  const allErrors = [];
  
  // Start all waves with proper delays but don't wait for completion
  const allWavePromises = [];
  
  try {
    for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
      const wave = waves[waveIndex];
      
      // Calculate delay for this wave (first wave starts immediately)
      const waveDelay = waveIndex * config.WAVE_DELAY;
      
      const wavePromise = new Promise((resolve) => {
        setTimeout(async () => {
          baseLogger.info('Starting wave', {
            operationId,
            waveIndex,
            batchCount: wave.length,
            config: config.name
          });
          
          // Execute batches in this wave with staggered starts
          const batchPromises = wave.map((batch, batchInWaveIndex) => {
            return new Promise((batchResolve) => {
              const jitter = Math.random() * config.JITTER_MAX;
              const delay = (batchInWaveIndex * config.BATCH_STAGGER) + jitter;
              
              setTimeout(async () => {
                try {
                  await executeSingleBatch(
                    batch, 
                    tempFolderPath, 
                    config, 
                    batchLogger, 
                    batchIndex + batchInWaveIndex, 
                    dbx
                  );
                  batchResolve({ success: true, batchIndex: batchIndex + batchInWaveIndex });
                } catch (error) {
                  allErrors.push({
                    batchIndex: batchIndex + batchInWaveIndex,
                    error
                  });
                  batchResolve({ success: false, batchIndex: batchIndex + batchInWaveIndex, error });
                }
              }, delay);
            });
          });
          
          // Wait for all batches in this wave to complete
          const waveResults = await Promise.all(batchPromises);
          
          baseLogger.info('Wave completed', {
            operationId,
            waveIndex,
            successCount: waveResults.filter(r => r.success).length,
            failureCount: waveResults.filter(r => !r.success).length,
            config: config.name
          });
          
          resolve(waveResults);
        }, waveDelay);
      });
      
      allWavePromises.push(wavePromise);
      batchIndex += wave.length;
    }
    
    // Wait for all waves to complete
    await Promise.all(allWavePromises);
    
    // Check if any batches failed
    if (allErrors.length > 0) {
      const errorSummary = `${allErrors.length} of ${totalBatches} batches failed`;
      const firstError = allErrors[0].error;
      
      batchLogger.logOperationComplete(false, new Error(errorSummary));
      
      throw new Error(`Batch operation partially failed: ${errorSummary}. First error: ${firstError.message}`);
    }
    
    batchLogger.logOperationComplete(true);
    
    baseLogger.info('All batches completed successfully', {
      operationId,
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