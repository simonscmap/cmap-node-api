const CURRENT_CONFIG = 'test'; // Options: 'conservative', 'aggressive', 'sequential'

const BATCH_CONFIGS = {
  conservative: {
    // === BATCH EXECUTION SETTINGS ===
    BATCH_SIZE: 10, // Files per batch (lower = less strain per operation)
    PARALLEL_COUNT: 20, // Batches running simultaneously (lower = less API pressure)
    WAVE_DELAY: 1000, // Milliseconds between waves (higher = more breathing room)
    BATCH_STAGGER: 100, // Milliseconds between batch starts in same wave

    // === RETRY CONFIGURATION ===
    MAX_RETRIES: 3, // Number of retry attempts per failed operation
    RETRY_BASE_DELAY: 2000, // Base delay for exponential backoff (milliseconds)
    RETRY_MAX_DELAY: 60000, // Maximum delay cap for retries

    // === TIMEOUT SETTINGS ===
    BATCH_TIMEOUT: 300000, // Maximum time to wait for single batch (5 minutes)
    POLL_INTERVAL: 5000, // How often to check batch status (milliseconds)

    // === RATE LIMIT HANDLING ===
    RATE_LIMIT_BACKOFF: 30000, // Base delay when hitting 429 errors
    JITTER_MAX: 1000, // Random jitter to prevent synchronized retries
  },

  aggressive: {
    // === BATCH EXECUTION SETTINGS ===
    BATCH_SIZE: 200, // Larger batches for efficiency
    PARALLEL_COUNT: 3, // More simultaneous operations
    WAVE_DELAY: 10000, // Shorter delays between waves
    BATCH_STAGGER: 2000, // Faster staggered starts

    // === RETRY CONFIGURATION ===
    MAX_RETRIES: 5, // More retry attempts
    RETRY_BASE_DELAY: 1000, // Faster initial retries
    RETRY_MAX_DELAY: 30000, // Lower max delay for speed

    // === TIMEOUT SETTINGS ===
    BATCH_TIMEOUT: 180000, // Shorter timeout (3 minutes)
    POLL_INTERVAL: 3000, // More frequent status checks

    // === RATE LIMIT HANDLING ===
    RATE_LIMIT_BACKOFF: 20000, // Shorter rate limit delays
    JITTER_MAX: 2000, // Higher jitter for busy periods
  },

  sequential: {
    // === BATCH EXECUTION SETTINGS ===
    BATCH_SIZE: 50, // Small batches for minimal impact
    PARALLEL_COUNT: 1, // No parallelism - purely sequential
    WAVE_DELAY: 5000, // Moderate delays between operations
    BATCH_STAGGER: 0, // No staggering needed with PARALLEL_COUNT=1

    // === RETRY CONFIGURATION ===
    MAX_RETRIES: 2, // Fewer retries since conflicts less likely
    RETRY_BASE_DELAY: 3000, // Conservative retry delays
    RETRY_MAX_DELAY: 30000, // Standard max delay

    // === TIMEOUT SETTINGS ===
    BATCH_TIMEOUT: 240000, // 4 minutes per batch
    POLL_INTERVAL: 4000, // Moderate polling frequency

    // === RATE LIMIT HANDLING ===
    RATE_LIMIT_BACKOFF: 45000, // Long delays for rate limits (shouldn't hit many)
    JITTER_MAX: 500, // Minimal jitter needed
  },

  base_case: {
    // === BATCH EXECUTION SETTINGS ===
    BATCH_SIZE: 'infinity', // Special case: all files in single batch
    PARALLEL_COUNT: 1, // Irrelevant but set for clarity
    WAVE_DELAY: 0, // Irrelevant but set for clarity
    BATCH_STAGGER: 0, // Irrelevant but set for clarity

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
 * BATCH_SIZE: Number of files included in each Dropbox batch operation
 * - Used by: stagedParallelExecutor (file chunking)
 * - Impact: Larger = fewer API calls but longer individual operations
 *
 * PARALLEL_COUNT: How many batches run simultaneously in each wave
 * - Used by: stagedParallelExecutor (wave creation)
 * - Impact: Higher = faster but more API pressure, may trigger rate limits
 *
 * WAVE_DELAY: Time to wait between waves of parallel batches
 * - Used by: stagedParallelExecutor (inter-wave delays)
 * - Impact: Longer = more breathing room for API, less chance of rate limits
 *
 * BATCH_STAGGER: Delay between starting batches within the same wave
 * - Used by: stagedParallelExecutor (intra-wave timing)
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
