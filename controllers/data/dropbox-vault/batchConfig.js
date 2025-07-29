const CURRENT_CONFIG = 'test'; // Options: 'conservative', 'aggressive', 'sequential'

const BATCH_CONFIGS = {
  test: {
    // === BATCH EXECUTION SETTINGS ===
    BATCH_SIZE: 10,
    PARALLEL_BATCH_COUNT: 10,
    BATCH_STAGGER: 500,

    // === RETRY CONFIGURATION ===
    MAX_RETRIES: 3,
    RETRY_BASE_DELAY: 2000,
    RETRY_MAX_DELAY: 60000,

    // === TIMEOUT SETTINGS ===
    BATCH_TIMEOUT: 300000,
    POLL_INTERVAL: 5000,

    // === RATE LIMIT HANDLING ===
    RATE_LIMIT_BACKOFF: 30000,
    JITTER_MAX: 1000,
  },
  base_case: {
    // === BATCH EXECUTION SETTINGS ===
    PARALLEL_BATCH_COUNT: 1, // Number of batches to run in parallel
    BATCH_STAGGER: 0, // Delay between starting batches

    // === RETRY CONFIGURATION ===
    MAX_RETRIES: 3, // Standard retry attempts
    RETRY_BASE_DELAY: 2000, // Standard retry delays
    RETRY_MAX_DELAY: 60000, // Standard max delay

    // === TIMEOUT SETTINGS ===
    BATCH_TIMEOUT: 600000, // 10 minutes for large single batch
    POLL_INTERVAL: 5000, // Standard polling frequency

    // === RATE LIMIT HANDLING ===
    RATE_LIMIT_BACKOFF: 30000, // Standard rate limit delays
    JITTER_MAX: 1000, // Standard jitter
  },
};

/**
 * Configuration Parameter Documentation:
 *
 * PARALLEL_BATCH_COUNT: How many batches run simultaneously in parallel
 * - Used by: stagedParallelExecutor (batch creation and execution)
 * - Impact: Higher = faster but more API pressure, may trigger rate limits
 *
 * BATCH_STAGGER: Delay between starting batches in parallel execution
 * - Used by: stagedParallelExecutor (batch timing)
 * - Impact: Prevents simultaneous API calls, reduces rate limit risk
 *
 * MAX_RETRIES: Number of retry attempts for failed operations
 * - Used by: retryHelpers (executeWithRetry function)
 * - Impact: Higher = more resilient but slower on persistent failures
 *
 * RETRY_BASE_DELAY: Base delay for exponential backoff calculation
 * - Used by: retryHelpers (calculateBackoffDelay function)
 * - Impact: Sets minimum wait time, affects total retry time
 *
 * RETRY_MAX_DELAY: Maximum delay cap for exponential backoff
 * - Used by: retryHelpers (calculateBackoffDelay function)
 * - Impact: Prevents extremely long waits, balances patience vs speed
 *
 * BATCH_TIMEOUT: Maximum time to wait for a single batch to complete
 * - Used by: stagedParallelExecutor (batch polling loops)
 * - Impact: Higher = more patient with slow operations, lower = fail faster
 *
 * POLL_INTERVAL: How frequently to check status of async batch operations
 * - Used by: stagedParallelExecutor (batch status polling)
 * - Impact: Lower = faster detection of completion, higher = less API overhead
 *
 * RATE_LIMIT_BACKOFF: Base delay when encountering 429 rate limit errors
 * - Used by: retryHelpers (handleRateLimitError function)
 * - Impact: How long to wait when rate limited, affects recovery time
 *
 * JITTER_MAX: Maximum random delay added to prevent synchronized operations
 * - Used by: retryHelpers, stagedParallelExecutor (timing randomization)
 * - Impact: Reduces thundering herd effects, spreads out API calls
 */

const getCurrentConfig = () => {
  const configName = CURRENT_CONFIG;
  return {
    name: configName,
    ...(BATCH_CONFIGS[configName] || BATCH_CONFIGS.conservative),
  };
};

module.exports = { BATCH_CONFIGS, getCurrentConfig };
