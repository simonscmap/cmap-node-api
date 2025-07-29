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
  
  // 409 - Most conflicts are retryable (file locks, concurrent operations, etc.)
  // Only exclude specific permanent conflicts
  if (error.status === 409) {
    const errorSummary = (error.error && error.error.error_summary) || '';
    const errorTag = (error.error && error.error.error && error.error.error['.tag']) || '';
    
    // Dropbox internal_error is permanent - never retry
    if (errorTag === 'internal_error' || errorSummary.includes('internal_error')) {
      return false;
    }
    
    // Check for other permanent conflicts that shouldn't be retried
    const permanentConflicts = [
      'invalid_cursor',
      'disallowed_name',
      'insufficient_space',
      'internal_error' // Add for double protection
    ];
    
    return !permanentConflicts.some(conflict => errorSummary.includes(conflict));
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
      // Return both result and retry count
      return { result, retryCount };
    } catch (error) {
      lastError = error;
      
      // Enhanced error logging with full context
      batchLogger.log.error(`Error in ${operationName}`, {
        batchIndex,
        attempt,
        retryCount,
        error: error.message,
        status: error.status,
        errorSummary: (error.error && error.error.error_summary),
        fullError: JSON.stringify(error, null, 2),
        config: config.name
      });
      
      // If this is the last attempt, don't retry
      if (attempt === config.MAX_RETRIES) {
        break;
      }
      
      // Check if error is retryable
      if (!isRetryableError(error)) {
        // Special case for internal_error - needs complete restart
        if (error.status === 409 && 
            (error.error && error.error.error && error.error.error['.tag'] === 'internal_error' || 
             error.error && error.error.error_summary && error.error.error_summary.includes('internal_error'))) {
          batchLogger.log.error('Dropbox internal_error - operation must be restarted', {
            batchIndex,
            attempt,
            error: error.message,
            recommendation: 'Restart entire batch operation with new request',
            config: config.name
          });
        }
        
        batchLogger.log.error(`Non-retryable error in ${operationName}`, {
          batchIndex,
          attempt,
          error: error.message,
          status: error.status,
          errorSummary: (error.error && error.error.error_summary),
          config: config.name
        });
        break;
      }
      
      retryCount++;
      
      // Log retry attempt for metrics tracking
      batchLogger.logRetryAttempt(batchIndex, error, operationName);
      
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