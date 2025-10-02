#!/usr/bin/env node

// Load environment variables from local .env.local file
require('dotenv').config({ path: __dirname + '/.env.local' });

/**
 * Endpoint Tester CLI - Entry point with argument parsing
 *
 * Usage:
 *   node endpointTester/cli.js /api/collections GET    # Test single endpoint
 *   node endpointTester/cli.js /api/collections        # Test endpoint group
 *   node endpointTester/cli.js --all                   # Test all endpoints
 *   node endpointTester/cli.js --help                  # Show help
 */

const chalk = require('chalk');
const TestRunner = require('./lib/TestRunner');
const AuthProvider = require('./lib/AuthProvider');
const ResponseValidator = require('./lib/ResponseValidator');
const ErrorFormatter = require('./lib/ErrorFormatter');
const { endpoints, helpers } = require('./config/endpoints');

class EndpointTesterCLI {
  constructor() {
    this.baseUrl = process.env.API_BASE_URL || 'http://localhost:8080';
    this.args = process.argv.slice(2);
    this.authProvider = new AuthProvider();
    this.responseValidator = new ResponseValidator();
    this.errorFormatter = new ErrorFormatter();
  }

  /**
   * Parse command line arguments
   */
  parseArgs() {
    if (
      this.args.length === 0 ||
      this.args.includes('--help') ||
      this.args.includes('-h')
    ) {
      return { action: 'help' };
    }

    if (this.args.includes('--all')) {
      return { action: 'all' };
    }

    // Single endpoint: path and optional method
    if (this.args.length >= 1) {
      const path = this.args[0];
      const method = this.args[1] ? this.args[1].toUpperCase() : null;

      // Check if this is a group path (like /api/collections)
      const groupName = this.extractGroupFromPath(path);
      if (groupName && !method) {
        return { action: 'group', groupName };
      }

      // Single endpoint test
      if (method) {
        return { action: 'single', path, method };
      }

      // Try to match as group first, then as single endpoint
      if (groupName) {
        return { action: 'group', groupName };
      }

      return { action: 'single', path, method: 'GET' };
    }

    return { action: 'help' };
  }

  /**
   * Extract group name from path
   */
  extractGroupFromPath(path) {
    // Map base URLs to group names
    const pathToGroup = {};
    Object.keys(endpoints).forEach((groupName) => {
      pathToGroup[endpoints[groupName].baseUrl] = groupName;
    });

    return pathToGroup[path];
  }

  /**
   * Format progress indicator
   */
  formatProgress(current, total) {
    const percentage = Math.round((current / total) * 100);
    const progressBar = this.createProgressBar(current, total, 20);
    return `[${progressBar}] ${current}/${total} (${percentage}%)`;
  }

  /**
   * Create a visual progress bar
   */
  createProgressBar(current, total, width = 20) {
    const filled = Math.round((current / total) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Show help message
   */
  showHelp() {
    console.log(
      chalk.blue.bold('\n╔══════════════════════════════════════════╗'),
    );
    console.log(
      chalk.blue.bold('║          Endpoint Tester CLI             ║'),
    );
    console.log(
      chalk.blue.bold('╚══════════════════════════════════════════╝\n'),
    );

    console.log(chalk.cyan.bold('DESCRIPTION:'));
    console.log(
      chalk.white(
        '  Manual endpoint testing tool with zero-friction CLI interface',
      ),
    );
    console.log(
      chalk.white(
        '  and automatic authentication. Test single endpoints, groups,',
      ),
    );
    console.log(
      chalk.white('  or all endpoints with comprehensive validation.\n'),
    );

    console.log(chalk.cyan.bold('USAGE:'));
    console.log(
      chalk.white(
        '  node endpointTester/cli.js <endpoint> [method]  # Test single endpoint',
      ),
    );
    console.log(
      chalk.white(
        '  node endpointTester/cli.js <group>              # Test endpoint group',
      ),
    );
    console.log(
      chalk.white(
        '  node endpointTester/cli.js --all                # Test all endpoints',
      ),
    );
    console.log(
      chalk.white(
        '  node endpointTester/cli.js --help               # Show this help\n',
      ),
    );

    console.log(chalk.cyan.bold('EXAMPLES:'));
    console.log(chalk.yellow('  # Test a specific endpoint with method:'));
    console.log(
      chalk.white('  node endpointTester/cli.js /api/collections GET'),
    );
    console.log(
      chalk.white('  node endpointTester/cli.js /api/user/profile POST\n'),
    );

    console.log(chalk.yellow('  # Test all endpoints in a group:'));
    console.log(chalk.white('  node endpointTester/cli.js /api/collections'));
    console.log(chalk.white('  node endpointTester/cli.js /api/user\n'));

    console.log(chalk.yellow('  # Test all endpoints (comprehensive test):'));
    console.log(chalk.white('  node endpointTester/cli.js --all\n'));

    console.log(chalk.yellow('  # Using npm scripts (recommended):'));
    console.log(chalk.white('  npm run test:endpoint /api/collections GET'));
    console.log(chalk.white('  npm run test:endpoint /api/collections'));
    console.log(chalk.white('  npm run test:endpoint:all\n'));

    console.log(chalk.cyan.bold('AVAILABLE ENDPOINT GROUPS:'));
    Object.keys(endpoints).forEach((groupName) => {
      const group = endpoints[groupName];
      console.log(chalk.green(`  📁 ${group.baseUrl}`));
      console.log(
        chalk.gray(
          `     ${group.endpoints.length} endpoints | Auth: ${
            group.auth || 'auto-detect'
          }`,
        ),
      );

      // Show sample endpoints from the group
      const sampleEndpoints = group.endpoints.slice(0, 3);
      sampleEndpoints.forEach((endpoint) => {
        console.log(chalk.gray(`     └─ ${endpoint.method} ${endpoint.path}`));
      });
      if (group.endpoints.length > 3) {
        console.log(
          chalk.gray(`     └─ ... and ${group.endpoints.length - 3} more`),
        );
      }
      console.log('');
    });

    console.log(chalk.cyan.bold('CONFIGURATION:'));
    console.log(chalk.white('  Environment Variables:'));
    console.log(chalk.gray(`    API_BASE_URL=${this.baseUrl}`));
    console.log(
      chalk.gray(
        '    JWT_TOKEN=<your-jwt-token> (for authenticated endpoints)',
      ),
    );
    console.log(
      chalk.gray('    API_KEY=<your-api-key> (alternative auth method)'),
    );
    console.log(
      chalk.gray(
        '    GOOGLE_ACCESS_TOKEN=<token> (for Google OAuth endpoints)\n',
      ),
    );

    console.log(chalk.white('  Default Settings:'));
    console.log(chalk.gray('    • Timeout: 10s (configurable per endpoint)'));
    console.log(chalk.gray('    • Auto-authentication detection'));
    console.log(chalk.gray('    • Response validation enabled'));
    console.log(chalk.gray('    • Colored output with progress indicators\n'));

    // Show authentication status
    const credValidation = this.authProvider.validateCredentials();
    console.log(chalk.cyan.bold('AUTHENTICATION STATUS:'));
    if (credValidation.isValid) {
      console.log(
        chalk.green('  ✅ All authentication credentials configured'),
      );
      console.log(chalk.gray('     Ready to test protected endpoints'));
    } else {
      console.log(
        chalk.yellow(
          `  ⚠️ ${credValidation.issues.length} authentication issues found:`,
        ),
      );
      credValidation.issues.forEach((issue) => {
        console.log(chalk.red(`     ❌ ${issue}`));
      });
      console.log(chalk.cyan('\n  💡 Tips:'));
      console.log(chalk.gray('     • Set JWT_TOKEN for JWT-based auth'));
      console.log(chalk.gray('     • Set API_KEY for API key-based auth'));
      console.log(
        chalk.gray('     • Some endpoints may work with auto-detection'),
      );
    }

    console.log(chalk.cyan.bold('\nFEATURES:'));
    console.log(chalk.green('  ✅ Auto-authentication detection'));
    console.log(chalk.green('  ✅ Comprehensive response validation'));
    console.log(chalk.green('  ✅ Colored output with progress indicators'));
    console.log(chalk.green('  ✅ Detailed error reporting with suggestions'));
    console.log(chalk.green('  ✅ Configurable timeouts per endpoint'));
    console.log(chalk.green('  ✅ Support for multiple auth strategies'));
    console.log(chalk.green('  ✅ Test data fixtures and cleanup'));

    console.log(chalk.cyan.bold('\nOUTPUT LEGEND:'));
    console.log(chalk.green('  ✅ PASSED - Test completed successfully'));
    console.log(chalk.red('  ❌ FAILED - Test failed (see error details)'));
    console.log(
      chalk.cyan('  🔐 Auth: <strategy> - Authentication method used'),
    );
    console.log(
      chalk.yellow('  ⚠️ Warning - Non-critical issues or fallback behavior'),
    );
    console.log(chalk.blue('  🧪 <test-name> - Individual test execution'));
    console.log(chalk.gray('  💡 <suggestion> - Actionable recommendations'));

    console.log(chalk.cyan.bold('\nTROUBLESHOoting:'));
    console.log(chalk.white('  Common Issues:'));
    console.log(
      chalk.gray(
        '  • "Endpoint not found" → Check spelling and available endpoints above',
      ),
    );
    console.log(
      chalk.gray('  • "Auth required" → Set appropriate environment variables'),
    );
    console.log(
      chalk.gray(
        '  • "Connection failed" → Verify API_BASE_URL and server status',
      ),
    );
    console.log(
      chalk.gray(
        '  • "Timeout" → Server may be slow, check endpoint-specific timeouts',
      ),
    );

    console.log(chalk.white('\n  Getting More Help:'));
    console.log(
      chalk.gray(
        '  • Check endpoint definitions in endpointTester/config/endpoints.js',
      ),
    );
    console.log(
      chalk.gray(
        '  • Review authentication setup in endpointTester/lib/AuthProvider.js',
      ),
    );
    console.log(
      chalk.gray('  • Enable verbose logging with DEBUG environment variable'),
    );

    console.log('');
  }

  /**
   * Test single endpoint
   */
  async testSingleEndpoint(path, method) {
    console.log(chalk.blue(`\nTesting single endpoint: ${method} ${path}`));

    const endpoint = helpers.findEndpoint(path, method);
    if (!endpoint) {
      console.log(chalk.red(`❌ Endpoint not found: ${method} ${path}`));
      console.log(chalk.gray('\nAvailable endpoints:'));
      const allEndpoints = helpers.getAllEndpoints();
      allEndpoints.forEach((ep) => {
        console.log(chalk.gray(`  ${ep.method} ${ep.fullPath}`));
      });
      return false;
    }

    // Show authentication info for this endpoint
    const authInfo = this.authProvider.getAuthInfo(path, method);
    if (authInfo.required) {
      console.log(chalk.cyan(`🔐 Auth: ${authInfo.description}`));
      if (!authInfo.configuredEndpoint) {
        console.log(chalk.yellow('⚠️ Using fallback authentication detection'));
      }
    }

    // Simple progress indicator for single tests
    process.stdout.write(
      chalk.cyan('\r[█████████████████████] 1/1 (100%) Testing... '),
    );

    const result = await this.runEndpointTest(endpoint);
    console.log(''); // Clear progress line

    return result;
  }

  /**
   * Test endpoint group
   */
  async testEndpointGroup(groupName) {
    console.log(chalk.blue(`\nTesting endpoint group: ${groupName}`));

    const groupEndpoints = helpers.getEndpointsByGroup(groupName);
    if (groupEndpoints.length === 0) {
      console.log(chalk.red(`❌ Group not found: ${groupName}`));
      console.log(chalk.gray('\nAvailable groups:'));
      Object.keys(endpoints).forEach((name) => {
        console.log(chalk.gray(`  ${name} (${endpoints[name].baseUrl})`));
      });
      return false;
    }

    console.log(
      chalk.gray(`Found ${groupEndpoints.length} endpoints in group\n`),
    );

    // Show authentication summary for the group
    const authStrategies = new Set();
    groupEndpoints.forEach((endpoint) => {
      const authInfo = this.authProvider.getAuthInfo(
        endpoint.fullPath,
        endpoint.method,
      );
      if (authInfo.required) {
        authStrategies.add(authInfo.strategy);
      }
    });

    if (authStrategies.size > 0) {
      console.log(
        chalk.cyan(
          `🔐 Authentication required: ${Array.from(authStrategies).join(
            ', ',
          )}\n`,
        ),
      );
    }

    let allPassed = true;
    let completedCount = 0;

    for (let i = 0; i < groupEndpoints.length; i++) {
      const endpoint = groupEndpoints[i];

      // Progress indicator
      const progress = this.formatProgress(i + 1, groupEndpoints.length);
      process.stdout.write(chalk.cyan(`\r${progress} Testing... `));

      const passed = await this.runEndpointTest(endpoint);
      if (!passed) {
        allPassed = false;
      }
      completedCount++;
      console.log(''); // Add spacing between tests
    }

    // Final progress summary
    const finalProgress = this.formatProgress(
      completedCount,
      groupEndpoints.length,
    );
    console.log(chalk.green(`${finalProgress} Group testing complete\n`));

    return allPassed;
  }

  /**
   * Test all endpoints
   */
  async testAllEndpoints() {
    console.log(chalk.blue('\nTesting all endpoints\n'));

    const allEndpoints = helpers.getAllEndpoints();
    console.log(chalk.gray(`Found ${allEndpoints.length} total endpoints\n`));

    let allPassed = true;
    let passedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < allEndpoints.length; i++) {
      const endpoint = allEndpoints[i];

      // Progress indicator with pass/fail stats
      const progress = this.formatProgress(i + 1, allEndpoints.length);
      const stats =
        passedCount + failedCount > 0
          ? ` (${passedCount} passed, ${failedCount} failed)`
          : '';
      process.stdout.write(chalk.cyan(`\r${progress} Testing...${stats} `));

      const passed = await this.runEndpointTest(endpoint);
      if (passed) {
        passedCount++;
      } else {
        failedCount++;
        allPassed = false;
      }
      console.log(''); // Add spacing between tests
    }

    // Summary
    console.log(chalk.blue.bold('=== Test Summary ==='));
    console.log(chalk.green(`✅ Passed: ${passedCount}`));
    if (failedCount > 0) {
      console.log(chalk.red(`❌ Failed: ${failedCount}`));
    }
    console.log(chalk.gray(`Total: ${allEndpoints.length}`));

    // Authentication summary
    const authStrategies = new Set();
    allEndpoints.forEach((endpoint) => {
      const authInfo = this.authProvider.getAuthInfo(
        endpoint.fullPath,
        endpoint.method,
      );
      if (authInfo.required) {
        authStrategies.add(authInfo.strategy);
      }
    });

    if (authStrategies.size > 0) {
      console.log(
        chalk.cyan(
          `🔐 Auth strategies used: ${Array.from(authStrategies).join(', ')}`,
        ),
      );
    }

    // Validation summary
    console.log(chalk.gray(`Response validation: enabled`));

    return allPassed;
  }

  /**
   * Run a single endpoint test
   */
  async runEndpointTest(endpoint) {
    const testName = `${endpoint.method} ${endpoint.fullPath}`;
    console.log(chalk.white(`🧪 ${testName}`));

    try {
      const runner = new TestRunner(this.baseUrl);

      // Configure the test runner based on endpoint definition
      let testRunner = runner[endpoint.method.toLowerCase()](endpoint.fullPath);

      // Apply authentication if required
      if (endpoint.auth && endpoint.auth !== 'none') {
        testRunner = testRunner.withAuth(endpoint.auth);
      }

      // Set expected status
      if (endpoint.expectedStatus) {
        testRunner = testRunner.expectStatus(endpoint.expectedStatus);
      }

      // Set expected structure
      if (endpoint.expectedStructure) {
        testRunner = testRunner.expectBodyStructure(endpoint.expectedStructure);
      }

      // Set expected headers
      if (endpoint.expectedHeaders) {
        Object.keys(endpoint.expectedHeaders).forEach((key) => {
          testRunner = testRunner.expectHeader(
            key,
            endpoint.expectedHeaders[key],
          );
        });
      }

      // Set timeout
      if (endpoint.timeout) {
        testRunner = testRunner.withTimeout(endpoint.timeout);
      }

      // Add request body for POST/PUT requests
      if (endpoint.bodyParams && ['POST', 'PUT'].includes(endpoint.method)) {
        testRunner = testRunner.withBody(endpoint.bodyParams);
      }

      // Add query parameters
      if (endpoint.queryParams) {
        testRunner = testRunner.withQuery(endpoint.queryParams);
      }

      const result = await testRunner.run();

      const success = result.status === 'PASS';
      const statusText = success ? 'PASSED' : 'FAILED';

      if (success) {
        console.log(chalk.green(`   ✅ ${statusText}`));
        if (result.response) {
          console.log(
            chalk.gray(
              `   Status: ${result.response.status} | Time: ${result.executionTime}ms`,
            ),
          );
        }

        // Show validation summary for successful tests
        if (result.validationResults && result.validationResults.length > 0) {
          const validationSummary = this.responseValidator.generateSummary(
            result.validationResults,
          );
          if (validationSummary.total > 0) {
            console.log(
              chalk.gray(
                `   Validations: ${validationSummary.passed}/${validationSummary.total} passed`,
              ),
            );
          }
        }

        return true;
      } else {
        console.log(chalk.red(`   ❌ ${statusText}`));
        if (result.response) {
          console.log(
            chalk.gray(
              `   Status: ${result.response.status} | Time: ${result.executionTime}ms`,
            ),
          );
        }

        // Enhanced error reporting using ErrorFormatter
        if (result.errors && result.errors.length > 0) {
          // Check if errors are already formatted objects
          const formattedErrors = result.errors.map((error) => {
            if (typeof error === 'object' && error.category) {
              return error; // Already formatted
            }
            return { message: error, category: 'test' }; // Simple error
          });

          formattedErrors.forEach((error) => {
            console.log(chalk.yellow(`   Error: ${error.message || error}`));
            if (error.suggestions && error.suggestions.length > 0) {
              console.log(chalk.cyan(`   💡 ${error.suggestions[0]}`)); // Show first suggestion
            }
          });
        }

        // Show validation details for failed tests
        if (result.validationResults && result.validationResults.length > 0) {
          const failures = result.validationResults.filter((r) => !r.passed);
          if (failures.length > 0) {
            console.log(
              chalk.yellow(`   Validation failures: ${failures.length}`),
            );
            failures.slice(0, 2).forEach((failure) => {
              // Show first 2 failures
              console.log(chalk.gray(`     • ${failure.message}`));
            });
          }
        }

        return false;
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Test execution failed: ${error.message}`));

      // Use ErrorFormatter for configuration/setup errors
      const formattedError = this.errorFormatter.formatConfigError(error);
      if (formattedError.suggestions && formattedError.suggestions.length > 0) {
        console.log(chalk.cyan(`   💡 ${formattedError.suggestions[0]}`));
      }

      return false;
    }
  }

  /**
   * Main CLI execution
   */
  async run() {
    const parsed = this.parseArgs();

    try {
      switch (parsed.action) {
        case 'help':
          this.showHelp();
          return true;

        case 'single':
          return await this.testSingleEndpoint(parsed.path, parsed.method);

        case 'group':
          return await this.testEndpointGroup(parsed.groupName);

        case 'all':
          return await this.testAllEndpoints();

        default:
          this.showHelp();
          return false;
      }
    } catch (error) {
      console.log(chalk.red(`\n❌ CLI Error: ${error.message}`));

      // Use ErrorFormatter for better CLI error messages
      const formattedError = this.errorFormatter.formatConfigError(error);
      if (formattedError.suggestions && formattedError.suggestions.length > 0) {
        console.log(chalk.yellow('\n💡 Suggested Actions:'));
        formattedError.suggestions.slice(0, 3).forEach((suggestion, index) => {
          console.log(chalk.gray(`   ${index + 1}. ${suggestion}`));
        });
      }

      return false;
    }
  }
}

// Execute CLI if run directly
if (require.main === module) {
  const cli = new EndpointTesterCLI();
  cli
    .run()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error(chalk.red(`Fatal error: ${error.message}`));
      process.exit(1);
    });
}

module.exports = EndpointTesterCLI;
