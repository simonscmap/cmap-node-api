const initLog = require('../log-service');
// const { monitor } = require('../mail-service/checkBouncedMail');
const {
  scheduleCleanupForAllTempFolders,
} = require('../controllers/data/dropbox-vault/vaultController');

const log = initLog('startup');

/**
 * Runs all startup tasks for the application
 * This should be called once when the server starts
 */
const runStartupTasks = async () => {
  log.info('Beginning application startup tasks');

  const startupTasks = [
    // {
    //   name: 'Bounced Mail Monitoring',
    //   task: () => monitor(),
    //   critical: false, // Don't block startup if this fails
    // },
    {
      name: 'Dropbox Temp Folder Cleanup',
      task: () => scheduleCleanupForAllTempFolders(),
      critical: false, // Don't block startup if this fails
    },
    // Add more startup tasks here as needed
  ];

  const results = await Promise.allSettled(
    startupTasks.map(async ({ name, task, critical }) => {
      try {
        log.info(`Starting: ${name}`);
        await task();
        log.info(`Completed: ${name}`);
        return { name, success: true };
      } catch (error) {
        log.error(`Failed: ${name}`, { error });
        if (critical) {
          throw new Error(`Critical startup task failed: ${name}`);
        }
        return { name, success: false, error };
      }
    }),
  );

  const successful = results.filter(
    (r) => r.status === 'fulfilled' && r.value.success,
  );
  const failed = results.filter(
    (r) =>
      r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success),
  );

  log.info('Startup tasks completed', {
    successful: successful.length,
    failed: failed.length,
    total: startupTasks.length,
  });

  if (failed.length > 0) {
    log.warn('Some startup tasks failed', {
      failedTasks: failed.map((f) =>
        f.status === 'fulfilled' ? f.value.name : 'Unknown',
      ),
    });
  }
};

module.exports = {
  runStartupTasks,
};
