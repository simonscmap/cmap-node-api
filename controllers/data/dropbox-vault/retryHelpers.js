// Retry logic with exponential backoff for Dropbox operations
const { setTimeout } = require('timers');

// Calculate exponential backoff delay with jitter
const calculateBackoffDelay = (retryCount, baseDelay, maxDelay, jitterMax) => {
  const exponentialDelay = baseDelay * Math.pow(2, retryCount);
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  const jitter = Math.random() * jitterMax;
  return cappedDelay + jitter;
};

// Handle 429 rate limit errors specifically
const handleRateLimitError = (error, config, batchLogger, batchIndex) => {
  if (error.status === 429) {
    // Extract retry-after header if available
    const retryAfter = error.error && error.error.retry_after
      ? error.error.retry_after * 1000 
      : config.RATE_LIMIT_BACKOFF;
    
    batchLogger.logRateLimitHit(batchIndex, retryAfter);
    return retryAfter;
  }
  return null;
};

// Check if error is retryable
const isRetryableError = (error) => {
  // 429 - Rate limit
  if (error.status === 429) return true;
  
  // 409 - Conflict (too_many_write_operations)
  if (error.status === 409 && 
      error.error && error.error.error_summary && error.error.error_summary.includes('too_many_write_operations')) {
    return true;
  }
  
  // 500+ - Server errors
  if (error.status >= 500) return true;
  
  // Network timeout errors
  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') return true;
  
  return false;
};

// Execute function with retry logic
const executeWithRetry = async (
  fn,
  config,
  batchLogger,
  batchIndex,
  operationName = 'operation'
) => {
  let lastError = null;
  let retryCount = 0;

  for (let attempt = 0; attempt <= config.MAX_RETRIES; attempt++) {
    try {
      const result = await fn();
      if (retryCount > 0) {
        batchLogger.log.info(`${operationName} succeeded after retries`, {
          batchIndex,
          attempt,
          retryCount,
          config: config.name
        });
      }
      return result;
    } catch (error) {
      lastError = error;
      
      // If this is the last attempt, don't retry
      if (attempt === config.MAX_RETRIES) {
        break;
      }
      
      // Check if error is retryable
      if (!isRetryableError(error)) {
        batchLogger.log.error(`Non-retryable error in ${operationName}`, {
          batchIndex,
          attempt,
          error: error.message,
          status: error.status,
          config: config.name
        });
        break;
      }
      
      retryCount++;
      
      // Calculate delay (special handling for rate limits)
      let delay;
      const rateLimitDelay = handleRateLimitError(error, config, batchLogger, batchIndex);
      if (rateLimitDelay) {
        delay = rateLimitDelay;
      } else {
        delay = calculateBackoffDelay(
          retryCount - 1, 
          config.RETRY_BASE_DELAY, 
          config.RETRY_MAX_DELAY, 
          config.JITTER_MAX
        );
      }
      
      batchLogger.log.warn(`${operationName} failed, retrying`, {
        batchIndex,
        attempt,
        retryCount,
        delay,
        error: error.message,
        status: error.status,
        config: config.name
      });
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // All retries exhausted
  throw lastError;
};

module.exports = {
  calculateBackoffDelay,
  handleRateLimitError,
  isRetryableError,
  executeWithRetry
};