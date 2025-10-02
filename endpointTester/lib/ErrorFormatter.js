/**
 * ErrorFormatter - Actionable error message formatting and categorization
 * Provides clear, detailed, and actionable error messages for debugging endpoint tests
 */

const chalk = require('chalk');

class ErrorFormatter {
  constructor() {
    this.errorCategories = {
      NETWORK: 'network',
      AUTHENTICATION: 'authentication',
      VALIDATION: 'validation',
      HTTP: 'http',
      TIMEOUT: 'timeout',
      CONFIGURATION: 'configuration',
      UNKNOWN: 'unknown'
    };
  }

  /**
   * Format HTTP error response (4xx, 5xx status codes)
   */
  formatHttpError(error) {
    if (!error.response) {
      return this.formatNetworkError(error);
    }

    const response = error.response;
    const status = response.status;
    const statusText = response.statusText || 'Unknown Error';
    const url = error.config ? error.config.url : 'Unknown URL';
    const method = error.config ? error.config.method.toUpperCase() : 'Unknown Method';

    // Categorize the error
    let category = this.errorCategories.HTTP;
    let suggestions = [];

    if (status === 401) {
      category = this.errorCategories.AUTHENTICATION;
      suggestions = [
        'Check if authentication credentials are correct',
        'Verify API key or JWT token is valid and not expired',
        'Ensure the correct authentication strategy is being used',
        'Check if the endpoint requires authentication'
      ];
    } else if (status === 403) {
      category = this.errorCategories.AUTHENTICATION;
      suggestions = [
        'Check if user has sufficient permissions for this endpoint',
        'Verify the API key or token has the required scopes',
        'Check if the resource access is allowed for this user'
      ];
    } else if (status === 404) {
      suggestions = [
        'Verify the endpoint URL is correct',
        'Check if the resource ID exists',
        'Ensure the API version in the URL is correct',
        'Verify the endpoint is available on this environment'
      ];
    } else if (status === 422) {
      category = this.errorCategories.VALIDATION;
      suggestions = [
        'Check request body format and required fields',
        'Verify data types match the API specification',
        'Ensure all required parameters are provided',
        'Check for invalid or malformed data in the request'
      ];
    } else if (status === 429) {
      suggestions = [
        'Reduce request frequency - rate limit exceeded',
        'Wait before retrying the request',
        'Check if there are rate limiting headers in the response',
        'Consider implementing exponential backoff'
      ];
    } else if (status >= 500) {
      suggestions = [
        'This is a server error - check server logs',
        'Retry the request after a short delay',
        'Verify the server is running and accessible',
        'Check if there are any maintenance windows'
      ];
    }

    // Try to extract additional error details from response body
    let errorDetails = '';
    if (response.data) {
      if (typeof response.data === 'string') {
        errorDetails = response.data.substring(0, 200);
      } else if (typeof response.data === 'object') {
        errorDetails = this.extractErrorMessage(response.data);
      }
    }

    return {
      category: category,
      message: `HTTP ${status} ${statusText}: ${method} ${url}`,
      details: errorDetails || `Server returned ${status} status`,
      suggestions: suggestions,
      technical: {
        status: status,
        statusText: statusText,
        method: method,
        url: url,
        headers: response.headers,
        data: response.data
      }
    };
  }

  /**
   * Format network-related errors (no response received)
   */
  formatNetworkError(error) {
    const url = error.config ? error.config.url : 'Unknown URL';
    const method = error.config ? error.config.method.toUpperCase() : 'Unknown Method';

    let category = this.errorCategories.NETWORK;
    let message = '';
    let suggestions = [];

    if (error.code === 'ECONNREFUSED') {
      message = `Connection refused: ${method} ${url}`;
      suggestions = [
        'Check if the server is running',
        'Verify the server URL and port are correct',
        'Ensure there are no firewall issues',
        'Check if the service is available on this network'
      ];
    } else if (error.code === 'ENOTFOUND') {
      message = `DNS lookup failed: ${url}`;
      suggestions = [
        'Verify the hostname is correct',
        'Check DNS configuration',
        'Ensure internet connectivity',
        'Try using IP address instead of hostname'
      ];
    } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      category = this.errorCategories.TIMEOUT;
      message = `Request timeout: ${method} ${url}`;
      suggestions = [
        'Increase the request timeout value',
        'Check network connectivity and latency',
        'Verify the server is responding normally',
        'Consider if this endpoint typically takes longer to respond'
      ];
    } else if (error.code === 'ECONNRESET') {
      message = `Connection reset: ${method} ${url}`;
      suggestions = [
        'Server unexpectedly closed the connection',
        'Check server logs for issues',
        'Retry the request',
        'Verify network stability'
      ];
    } else if (error.message.includes('certificate') || error.message.includes('SSL')) {
      message = `SSL/TLS certificate error: ${url}`;
      suggestions = [
        'Check if the SSL certificate is valid',
        'Verify certificate chain is complete',
        'Check if certificate has expired',
        'Consider bypassing SSL verification for testing (not recommended for production)'
      ];
    } else {
      message = `Network error: ${error.message}`;
      suggestions = [
        'Check network connectivity',
        'Verify server is accessible',
        'Check for proxy or firewall issues',
        'Review error details for specific network issue'
      ];
    }

    return {
      category: category,
      message: message,
      details: error.message,
      suggestions: suggestions,
      technical: {
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        hostname: error.hostname,
        port: error.port,
        address: error.address
      }
    };
  }

  /**
   * Format authentication-related errors
   */
  formatAuthError(error, strategy) {
    const suggestions = [];

    if (strategy === 'jwt') {
      suggestions.push(
        'Verify JWT token is provided and valid',
        'Check if token has expired',
        'Ensure token is correctly formatted',
        'Set TEST_JWT_TOKEN environment variable'
      );
    } else if (strategy === 'headerapikey') {
      suggestions.push(
        'Verify API key is provided in x-api-key header',
        'Check if API key is valid and active',
        'Ensure API key has correct permissions',
        'Set TEST_API_KEY environment variable'
      );
    } else if (strategy === 'guest') {
      suggestions.push(
        'Verify guest token is valid',
        'Check if guest access is allowed for this endpoint',
        'Set TEST_GUEST_TOKEN environment variable'
      );
    } else {
      suggestions.push(
        'Check authentication credentials',
        'Verify the correct authentication method is used',
        'Review endpoint authentication requirements'
      );
    }

    return {
      category: this.errorCategories.AUTHENTICATION,
      message: `Authentication failed for strategy: ${strategy}`,
      details: error.message,
      suggestions: suggestions,
      technical: {
        strategy: strategy,
        originalError: error
      }
    };
  }

  /**
   * Format validation errors
   */
  formatValidationError(validationResults) {
    const failures = validationResults.filter(r => !r.passed);

    if (failures.length === 0) {
      return null;
    }

    const suggestions = [];
    const details = [];

    failures.forEach(failure => {
      details.push(`${failure.type}: ${failure.message}`);

      if (failure.type === 'status') {
        suggestions.push(
          `Expected HTTP ${failure.expected} but got ${failure.actual}`,
          'Check if endpoint URL is correct',
          'Verify request parameters and authentication'
        );
      } else if (failure.type === 'structure') {
        if (failure.missingFields && failure.missingFields.length > 0) {
          suggestions.push(
            `Missing fields: ${failure.missingFields.join(', ')}`,
            'Check API documentation for response structure',
            'Verify endpoint is returning expected data format'
          );
        }
      } else if (failure.type === 'header') {
        suggestions.push(
          `Header '${failure.headerName}' validation failed`,
          'Check if server is setting correct headers',
          'Verify expected header value is correct'
        );
      }
    });

    return {
      category: this.errorCategories.VALIDATION,
      message: `${failures.length} validation${failures.length === 1 ? '' : 's'} failed`,
      details: details.join('\n'),
      suggestions: [...new Set(suggestions)], // Remove duplicates
      technical: {
        failureCount: failures.length,
        failures: failures
      }
    };
  }

  /**
   * Format configuration errors
   */
  formatConfigError(error) {
    const suggestions = [
      'Check .env file configuration',
      'Verify all required environment variables are set',
      'Review endpoint configuration in config/endpoints.js',
      'Check file paths and permissions'
    ];

    return {
      category: this.errorCategories.CONFIGURATION,
      message: `Configuration error: ${error.message}`,
      details: error.message,
      suggestions: suggestions,
      technical: {
        originalError: error
      }
    };
  }

  /**
   * Extract error message from response body
   */
  extractErrorMessage(responseData) {
    if (!responseData) return '';

    // Common error message patterns
    if (responseData.error) {
      if (typeof responseData.error === 'string') {
        return responseData.error;
      } else if (responseData.error.message) {
        return responseData.error.message;
      }
    }

    if (responseData.message) {
      return responseData.message;
    }

    if (responseData.details) {
      return responseData.details;
    }

    if (responseData.description) {
      return responseData.description;
    }

    // For validation errors, try to extract field-specific messages
    if (responseData.errors && Array.isArray(responseData.errors)) {
      return responseData.errors.map(err => {
        if (typeof err === 'string') return err;
        if (err.message) return err.message;
        if (err.field && err.error) return `${err.field}: ${err.error}`;
        return JSON.stringify(err);
      }).join('; ');
    }

    // Fallback: JSON stringify but limit length
    const jsonStr = JSON.stringify(responseData);
    return jsonStr.length > 200 ? jsonStr.substring(0, 200) + '...' : jsonStr;
  }

  /**
   * Format complete error report with colors (if supported)
   */
  formatErrorReport(error, useColors = true) {
    if (!error) return '';

    const colorize = useColors && chalk ? chalk : {
      red: (text) => text,
      yellow: (text) => text,
      cyan: (text) => text,
      green: (text) => text,
      gray: (text) => text,
      bold: (text) => text
    };

    let report = '';

    // Header with category and message
    report += colorize.red.bold(`\n❌ ${error.category.toUpperCase()} ERROR\n`);
    report += colorize.bold(`${error.message}\n\n`);

    // Details section
    if (error.details) {
      report += colorize.cyan('Details:\n');
      report += `${error.details}\n\n`;
    }

    // Suggestions section
    if (error.suggestions && error.suggestions.length > 0) {
      report += colorize.yellow('💡 Suggested Actions:\n');
      error.suggestions.forEach((suggestion, index) => {
        report += `   ${index + 1}. ${suggestion}\n`;
      });
      report += '\n';
    }

    // Technical details (only for verbose/debug mode)
    if (process.env.ENDPOINT_TEST_VERBOSE === 'true' && error.technical) {
      report += colorize.gray('Technical Details:\n');
      report += colorize.gray(JSON.stringify(error.technical, null, 2));
      report += '\n\n';
    }

    return report;
  }

  /**
   * Format a summary of multiple errors
   */
  formatErrorSummary(errors) {
    if (!errors || errors.length === 0) return '';

    const categoryCounts = {};
    errors.forEach(error => {
      const category = error.category || this.errorCategories.UNKNOWN;
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    let summary = `\n📊 Error Summary (${errors.length} total):\n`;
    Object.keys(categoryCounts).forEach(category => {
      summary += `   ${category}: ${categoryCounts[category]}\n`;
    });

    return summary;
  }

  /**
   * Create a simplified error object for JSON output
   */
  toJSON(error) {
    return {
      category: error.category,
      message: error.message,
      details: error.details,
      suggestions: error.suggestions,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ErrorFormatter;