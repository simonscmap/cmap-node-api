/**
 * ResponseValidator - Comprehensive response validation and error reporting
 * Validates HTTP responses against expected criteria with detailed error reporting
 */

class ResponseValidator {
  constructor() {
    this.validationRules = [];
  }

  /**
   * Main validation method - validates response against expected criteria
   */
  async validate(response, expectations) {
    const validationResults = [];

    // Validate status code
    if (expectations.expectedStatus !== undefined) {
      validationResults.push(this.validateStatus(response.status, expectations.expectedStatus));
    }

    // Validate response structure
    if (expectations.expectedStructure) {
      validationResults.push(this.validateStructure(response.body, expectations.expectedStructure));
    }

    // Validate headers
    if (expectations.expectedHeaders && Object.keys(expectations.expectedHeaders).length > 0) {
      validationResults.push(...this.validateHeaders(response.headers, expectations.expectedHeaders));
    }

    // Validate content type if not explicitly checked in headers
    if (response.headers && response.headers['content-type'] && !expectations.expectedHeaders) {
      validationResults.push(this.validateContentType(response.headers['content-type'], response.body));
    }

    // Validate response body is not empty for successful requests (unless explicitly expecting empty)
    if (response.status >= 200 && response.status < 300 && expectations.expectEmpty !== true) {
      validationResults.push(this.validateNotEmpty(response.body));
    }

    return validationResults.filter(result => result !== null);
  }

  /**
   * Validate HTTP status code
   */
  validateStatus(actualStatus, expectedStatus) {
    const passed = actualStatus === expectedStatus;

    return {
      type: 'status',
      passed: passed,
      message: passed
        ? `Status code ${actualStatus} matches expected ${expectedStatus}`
        : `Status code mismatch: expected ${expectedStatus}, got ${actualStatus}`,
      expected: expectedStatus,
      actual: actualStatus,
      severity: passed ? 'info' : 'error'
    };
  }

  /**
   * Validate response body structure
   */
  validateStructure(body, expectedStructure) {
    if (!body) {
      return {
        type: 'structure',
        passed: false,
        message: 'Response body is empty, cannot validate structure',
        expected: expectedStructure,
        actual: null,
        severity: 'error'
      };
    }

    try {
      // Handle different types of expected structures
      if (Array.isArray(expectedStructure)) {
        return this.validateArrayStructure(body, expectedStructure);
      } else if (typeof expectedStructure === 'object') {
        return this.validateObjectStructure(body, expectedStructure);
      } else {
        return this.validateFieldPresence(body, expectedStructure);
      }
    } catch (error) {
      return {
        type: 'structure',
        passed: false,
        message: `Structure validation error: ${error.message}`,
        expected: expectedStructure,
        actual: body,
        severity: 'error'
      };
    }
  }

  /**
   * Validate array structure (list of required fields)
   */
  validateArrayStructure(body, requiredFields) {
    const missingFields = [];
    const extraInfo = [];

    // If body is an array, validate the first element
    const targetObject = Array.isArray(body) ? (body[0] || {}) : body;

    if (!targetObject || typeof targetObject !== 'object') {
      return {
        type: 'structure',
        passed: false,
        message: 'Expected response to contain an object or array of objects',
        expected: requiredFields,
        actual: typeof body,
        severity: 'error'
      };
    }

    // Check for required fields
    requiredFields.forEach(field => {
      if (!(field in targetObject)) {
        missingFields.push(field);
      }
    });

    // Add information about array length if applicable
    if (Array.isArray(body)) {
      extraInfo.push(`Array length: ${body.length}`);
    }

    const passed = missingFields.length === 0;

    return {
      type: 'structure',
      passed: passed,
      message: passed
        ? `All required fields present: [${requiredFields.join(', ')}]${extraInfo.length ? ` (${extraInfo.join(', ')})` : ''}`
        : `Missing required fields: [${missingFields.join(', ')}]`,
      expected: requiredFields,
      actual: Object.keys(targetObject),
      missingFields: missingFields,
      severity: passed ? 'info' : 'error',
      extraInfo: extraInfo
    };
  }

  /**
   * Validate object structure (nested object validation)
   */
  validateObjectStructure(body, expectedStructure) {
    const violations = [];
    const validFields = [];

    if (!body || typeof body !== 'object') {
      return {
        type: 'structure',
        passed: false,
        message: 'Expected response to be an object',
        expected: expectedStructure,
        actual: typeof body,
        severity: 'error'
      };
    }

    // Recursively validate nested structure
    this.validateNestedStructure(body, expectedStructure, '', violations, validFields);

    const passed = violations.length === 0;

    return {
      type: 'structure',
      passed: passed,
      message: passed
        ? `Object structure valid (${validFields.length} fields checked)`
        : `Structure violations: ${violations.join('; ')}`,
      expected: expectedStructure,
      actual: this.getObjectStructure(body),
      violations: violations,
      validFields: validFields,
      severity: passed ? 'info' : 'error'
    };
  }

  /**
   * Validate nested object structure recursively
   */
  validateNestedStructure(actual, expected, path, violations, validFields) {
    Object.keys(expected).forEach(key => {
      const fieldPath = path ? `${path}.${key}` : key;
      const expectedValue = expected[key];
      const actualValue = actual[key];

      if (actualValue === undefined) {
        violations.push(`Missing field: ${fieldPath}`);
      } else if (typeof expectedValue === 'object' && expectedValue !== null && !Array.isArray(expectedValue)) {
        if (typeof actualValue === 'object' && actualValue !== null) {
          this.validateNestedStructure(actualValue, expectedValue, fieldPath, violations, validFields);
        } else {
          violations.push(`Type mismatch at ${fieldPath}: expected object, got ${typeof actualValue}`);
        }
      } else if (typeof expectedValue === 'string') {
        // String value indicates expected type
        if (typeof actualValue !== expectedValue) {
          violations.push(`Type mismatch at ${fieldPath}: expected ${expectedValue}, got ${typeof actualValue}`);
        } else {
          validFields.push(fieldPath);
        }
      } else {
        validFields.push(fieldPath);
      }
    });
  }

  /**
   * Validate field presence (simple field name validation)
   */
  validateFieldPresence(body, fieldName) {
    if (!body || typeof body !== 'object') {
      return {
        type: 'structure',
        passed: false,
        message: `Cannot check for field '${fieldName}' - response body is not an object`,
        expected: fieldName,
        actual: typeof body,
        severity: 'error'
      };
    }

    const targetObject = Array.isArray(body) ? (body[0] || {}) : body;
    const passed = fieldName in targetObject;

    return {
      type: 'structure',
      passed: passed,
      message: passed
        ? `Field '${fieldName}' is present`
        : `Field '${fieldName}' is missing`,
      expected: fieldName,
      actual: Object.keys(targetObject),
      severity: passed ? 'info' : 'warning'
    };
  }

  /**
   * Validate HTTP headers
   */
  validateHeaders(actualHeaders, expectedHeaders) {
    const results = [];

    Object.keys(expectedHeaders).forEach(headerName => {
      const expectedValue = expectedHeaders[headerName];
      const actualValue = actualHeaders[headerName.toLowerCase()];

      const passed = actualValue === expectedValue ||
                    (actualValue && actualValue.includes && actualValue.includes(expectedValue));

      results.push({
        type: 'header',
        passed: passed,
        message: passed
          ? `Header '${headerName}' matches expected value`
          : `Header '${headerName}' mismatch: expected '${expectedValue}', got '${actualValue || 'undefined'}'`,
        expected: expectedValue,
        actual: actualValue,
        headerName: headerName,
        severity: passed ? 'info' : 'warning'
      });
    });

    return results;
  }

  /**
   * Validate content type consistency
   */
  validateContentType(contentType, body) {
    const isJson = contentType.includes('application/json');
    const isJsonBody = typeof body === 'object' && body !== null;

    const passed = (isJson && isJsonBody) || (!isJson && !isJsonBody) || body === null;

    return {
      type: 'contentType',
      passed: passed,
      message: passed
        ? `Content-Type '${contentType}' matches body format`
        : `Content-Type mismatch: '${contentType}' but body is ${typeof body}`,
      expected: isJson ? 'object' : 'non-object',
      actual: typeof body,
      contentType: contentType,
      severity: passed ? 'info' : 'warning'
    };
  }

  /**
   * Validate that response is not empty (for successful requests)
   */
  validateNotEmpty(body) {
    const isEmpty = body === null || body === undefined ||
                   (typeof body === 'string' && body.trim() === '') ||
                   (Array.isArray(body) && body.length === 0) ||
                   (typeof body === 'object' && Object.keys(body).length === 0);

    return {
      type: 'notEmpty',
      passed: !isEmpty,
      message: isEmpty
        ? 'Response body is empty'
        : `Response body contains data (${this.getBodyDescription(body)})`,
      expected: 'non-empty response',
      actual: this.getBodyDescription(body),
      severity: isEmpty ? 'warning' : 'info'
    };
  }

  /**
   * Get a description of the response body for logging
   */
  getBodyDescription(body) {
    if (body === null || body === undefined) return 'null/undefined';
    if (typeof body === 'string') return `string (${body.length} chars)`;
    if (Array.isArray(body)) return `array (${body.length} items)`;
    if (typeof body === 'object') return `object (${Object.keys(body).length} keys)`;
    return typeof body;
  }

  /**
   * Get simplified object structure for logging
   */
  getObjectStructure(obj, maxDepth = 2, currentDepth = 0) {
    if (currentDepth >= maxDepth || !obj || typeof obj !== 'object') {
      return typeof obj;
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return 'array (empty)';
      return `array (${obj.length} items): [${this.getObjectStructure(obj[0], maxDepth, currentDepth + 1)}]`;
    }

    const structure = {};
    Object.keys(obj).forEach(key => {
      structure[key] = this.getObjectStructure(obj[key], maxDepth, currentDepth + 1);
    });

    return structure;
  }

  /**
   * Custom validation rule registration
   */
  addValidationRule(rule) {
    this.validationRules.push(rule);
  }

  /**
   * Apply custom validation rules
   */
  async applyCustomRules(response) {
    const results = [];

    for (const rule of this.validationRules) {
      try {
        const result = await rule(response);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        results.push({
          type: 'customRule',
          passed: false,
          message: `Custom rule error: ${error.message}`,
          severity: 'error'
        });
      }
    }

    return results;
  }

  /**
   * Generate validation summary
   */
  generateSummary(validationResults) {
    const summary = {
      total: validationResults.length,
      passed: 0,
      failed: 0,
      warnings: 0,
      errors: 0,
      details: validationResults
    };

    validationResults.forEach(result => {
      if (result.passed) {
        summary.passed++;
      } else {
        summary.failed++;
      }

      if (result.severity === 'warning') {
        summary.warnings++;
      } else if (result.severity === 'error') {
        summary.errors++;
      }
    });

    summary.success = summary.errors === 0;

    return summary;
  }
}

module.exports = ResponseValidator;