// Enhanced logging for batch operations with performance metrics
const fs = require('fs');
const path = require('path');

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
      waveIndex: batchTiming ? batchTiming.waveIndex : null,
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
      // Flatten config object with correct property names
      configName: this.metrics.config ? this.metrics.config.name : null,
      configBatchSize: this.metrics.config
        ? this.metrics.config.BATCH_SIZE
        : null,
      configParallelCount: this.metrics.config
        ? this.metrics.config.PARALLEL_COUNT
        : null,
      configWaveDelay: this.metrics.config
        ? this.metrics.config.WAVE_DELAY
        : null,
      configMaxRetries: this.metrics.config
        ? this.metrics.config.MAX_RETRIES
        : null,
      configRetryBaseDelay: this.metrics.config
        ? this.metrics.config.RETRY_BASE_DELAY
        : null,
      configBatchTimeout: this.metrics.config
        ? this.metrics.config.BATCH_TIMEOUT
        : null,
      error: error ? error.message : null,
      timestamp: new Date().toISOString(),
    };

    this.log.info('Batch operation completed', summary);

    // Also log full metrics for analysis with flattened config
    const flattenedMetrics = {
      ...this.metrics,
      // Replace config object with flattened values using correct property names
      configName: this.metrics.config ? this.metrics.config.name : null,
      configBatchSize: this.metrics.config
        ? this.metrics.config.BATCH_SIZE
        : null,
      configParallelCount: this.metrics.config
        ? this.metrics.config.PARALLEL_COUNT
        : null,
      configWaveDelay: this.metrics.config
        ? this.metrics.config.WAVE_DELAY
        : null,
      configMaxRetries: this.metrics.config
        ? this.metrics.config.MAX_RETRIES
        : null,
      configRetryBaseDelay: this.metrics.config
        ? this.metrics.config.RETRY_BASE_DELAY
        : null,
      configBatchTimeout: this.metrics.config
        ? this.metrics.config.BATCH_TIMEOUT
        : null,
      configPollInterval: this.metrics.config
        ? this.metrics.config.POLL_INTERVAL
        : null,
      configRateLimitBackoff: this.metrics.config
        ? this.metrics.config.RATE_LIMIT_BACKOFF
        : null,
      configJitterMax: this.metrics.config
        ? this.metrics.config.JITTER_MAX
        : null,
      configBatchStagger: this.metrics.config
        ? this.metrics.config.BATCH_STAGGER
        : null,
    };
    // Remove the original config object
    delete flattenedMetrics.config;

    this.log.info('Full operation metrics', {
      operationId: this.operationId,
      metrics: flattenedMetrics,
    });

    // Write to CSV if in development environment
    this.writeToCsv(flattenedMetrics);

    return summary;
  }

  writeToCsv(metrics) {
    // Only write to CSV in development environment
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    try {
      const csvFilePath =
        '/Users/howardwkim/src/simonscmap/cmap-node-api/batch-test/batch-performance-metrics.csv';

      // Format datetime as MM-DD HH:MM
      const now = new Date();
      const datetime = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate(),
      ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes(),
      ).padStart(2, '0')}`;

      // Format batchTimings as comma separated list of durations
      const batchTimingsStr = metrics.batchTimings
        .filter((timing) => timing && timing.duration !== null)
        .map((timing) => timing.duration)
        .join(';'); // Using semicolon since comma is CSV delimiter

      // Prepare CSV row data in the specified order
      const csvRow = [
        datetime,
        metrics.totalDuration !== null && metrics.totalDuration !== undefined
          ? metrics.totalDuration
          : '',
        metrics.totalFiles !== null && metrics.totalFiles !== undefined
          ? metrics.totalFiles
          : '',
        metrics.configParallelCount !== null &&
        metrics.configParallelCount !== undefined
          ? metrics.configParallelCount
          : '',
        metrics.configBatchSize !== null &&
        metrics.configBatchSize !== undefined
          ? metrics.configBatchSize
          : '',
        metrics.totalBatches !== null && metrics.totalBatches !== undefined
          ? metrics.totalBatches
          : '',
        metrics.configWaveDelay !== null &&
        metrics.configWaveDelay !== undefined
          ? metrics.configWaveDelay
          : '',
        metrics.completedBatches !== null &&
        metrics.completedBatches !== undefined
          ? metrics.completedBatches
          : '',
        metrics.failedBatches !== null && metrics.failedBatches !== undefined
          ? metrics.failedBatches
          : '',
        metrics.retriesUsed !== null && metrics.retriesUsed !== undefined
          ? metrics.retriesUsed
          : '',
        metrics.rateLimitHits !== null && metrics.rateLimitHits !== undefined
          ? metrics.rateLimitHits
          : '',
        batchTimingsStr,
        metrics.configBatchStagger !== null &&
        metrics.configBatchStagger !== undefined
          ? metrics.configBatchStagger
          : '',
      ];

      // Check if file exists, if not create with headers
      if (!fs.existsSync(csvFilePath)) {
        const headers = [
          'Datetime',
          'totalDuration (sec)',
          'FILE_COUNT',
          'PARALLEL_COUNT',
          'BATCH_SIZE',
          'totalBatches',
          'WAVE_DELAY',
          'completedBatches',
          'failedBatches',
          'retriesUsed',
          'rateLimitHits',
          'batchTimings (ms)',
          'BATCH_STAGGER',
        ];

        fs.writeFileSync(csvFilePath, headers.join(',') + '\n');
        this.log.info('Created CSV file for batch metrics', {
          path: csvFilePath,
        });
      }

      // Append the row to CSV
      const csvLine =
        csvRow
          .map((field) => {
            // Escape fields that contain commas or quotes
            if (
              typeof field === 'string' &&
              (field.includes(',') ||
                field.includes('"') ||
                field.includes('\n'))
            ) {
              return `"${field.replace(/"/g, '""')}"`;
            }
            return field;
          })
          .join(',') + '\n';

      fs.appendFileSync(csvFilePath, csvLine);
      this.log.info('Wrote batch metrics to CSV', {
        operationId: this.operationId,
        csvPath: csvFilePath,
      });
    } catch (error) {
      this.log.error('Failed to write batch metrics to CSV', {
        operationId: this.operationId,
        error: error.message,
      });
    }
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
