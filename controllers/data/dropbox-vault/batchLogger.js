// Enhanced logging for batch operations with performance metrics
class BatchPerformanceLogger {
  constructor(baseLogger, operationId) {
    this.log = baseLogger;
    this.operationId = operationId;
    this.startTime = Date.now();
    this.metrics = {
      totalFiles: 0,
      totalBatches: 0,
      completedBatches: 0,
      failedBatches: 0,
      retriesUsed: 0,
      rateLimitHits: 0,
      config: null,
      start: this.startTime,
      end: null,
      totalDuration: null,
      batchTimings: [],
    };
  }

  setConfig(config) {
    this.metrics.config = config;
    this.log.info('Batch operation started with config', {
      operationId: this.operationId,
      config: config,
      timestamp: new Date().toISOString(),
    });
  }

  setBatchCount(totalFiles, totalBatches) {
    this.metrics.totalFiles = totalFiles;
    this.metrics.totalBatches = totalBatches;
  }

  logBatchStart(batchIndex, batchSize, waveIndex) {
    const batchTiming = {
      batchIndex,
      batchSize,
      waveIndex,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      retries: 0,
      success: null,
      error: null,
    };

    this.metrics.batchTimings[batchIndex] = batchTiming;

    this.log.info('Batch started', {
      operationId: this.operationId,
      batchIndex,
      batchSize,
      waveIndex,
      config: this.metrics.config.name,
    });
  }

  logBatchComplete(batchIndex, success, error = null, retryCount = 0) {
    const batchTiming = this.metrics.batchTimings[batchIndex];
    if (batchTiming) {
      batchTiming.endTime = Date.now();
      batchTiming.duration = batchTiming.endTime - batchTiming.startTime;
      batchTiming.retries = retryCount;
      batchTiming.success = success;
      batchTiming.error = error ? error.message : null;
    }

    if (success) {
      this.metrics.completedBatches++;
    } else {
      this.metrics.failedBatches++;
    }

    this.metrics.retriesUsed += retryCount;

    this.log.info('Batch completed', {
      operationId: this.operationId,
      batchIndex,
      success,
      retries: retryCount,
      duration: batchTiming ? batchTiming.duration : null,
      error: error ? error.message : null,
      config: this.metrics.config.name,
    });
  }

  logRateLimitHit(batchIndex, retryAfter) {
    this.metrics.rateLimitHits++;
    this.log.warn('Rate limit hit', {
      operationId: this.operationId,
      batchIndex,
      retryAfter,
      rateLimitHits: this.metrics.rateLimitHits,
      config: this.metrics.config.name,
    });
  }

  logOperationComplete(success, error = null) {
    this.metrics.end = Date.now();
    this.metrics.totalDuration = Math.round(
      (this.metrics.end - this.metrics.start) / 1000,
    ); // Convert to seconds

    const summary = {
      operationId: this.operationId,
      success,
      totalDuration: this.metrics.totalDuration,
      totalFiles: this.metrics.totalFiles,
      totalBatches: this.metrics.totalBatches,
      completedBatches: this.metrics.completedBatches,
      failedBatches: this.metrics.failedBatches,
      retriesUsed: this.metrics.retriesUsed,
      rateLimitHits: this.metrics.rateLimitHits,
      averageBatchTime: this.getAverageBatchTime(),
      // Flatten config object
      configName: this.metrics.config ? this.metrics.config.name : null,
      configMaxConcurrency: this.metrics.config
        ? this.metrics.config.maxConcurrency
        : null,
      configBatchSize: this.metrics.config
        ? this.metrics.config.batchSize
        : null,
      configMaxRetries: this.metrics.config
        ? this.metrics.config.maxRetries
        : null,
      configRetryDelayMs: this.metrics.config
        ? this.metrics.config.retryDelayMs
        : null,
      error: error ? error.message : null,
      timestamp: new Date().toISOString(),
    };

    this.log.info('Batch operation completed', summary);

    // Also log full metrics for analysis with flattened config
    const flattenedMetrics = {
      ...this.metrics,
      // Replace config object with flattened values
      configName: this.metrics.config ? this.metrics.config.name : null,
      configMaxConcurrency: this.metrics.config
        ? this.metrics.config.maxConcurrency
        : null,
      configBatchSize: this.metrics.config
        ? this.metrics.config.batchSize
        : null,
      configMaxRetries: this.metrics.config
        ? this.metrics.config.maxRetries
        : null,
      configRetryDelayMs: this.metrics.config
        ? this.metrics.config.retryDelayMs
        : null,
    };
    // Remove the original config object
    delete flattenedMetrics.config;

    this.log.info('Full operation metrics', {
      operationId: this.operationId,
      metrics: flattenedMetrics,
    });

    return summary;
  }

  getAverageBatchTime() {
    const completedBatches = this.metrics.batchTimings.filter(
      (b) => b && b.success,
    );
    if (completedBatches.length === 0) return null;

    const totalTime = completedBatches.reduce((sum, b) => sum + b.duration, 0);
    return Math.round(totalTime / completedBatches.length);
  }

  getCurrentMetrics() {
    return { ...this.metrics };
  }
}

module.exports = BatchPerformanceLogger;
