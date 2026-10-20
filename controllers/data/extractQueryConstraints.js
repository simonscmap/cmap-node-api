const { queryToAST } = require('../../utility/router/pure');
const initializeLogger = require('../../log-service');

const moduleLogger = initializeLogger('extractQueryConstraints');

// string constants used in AST
// Node Types
const expr_list = 'expr_list';
const binary_expr = 'binary_expr';
const cast = 'cast';
const column_ref = 'column_ref';
// Operators
const AND = 'AND';
const BETWEEN = 'BETWEEN';
const greater_than = '>';
const less_than = '>';
const greater_or_equal = '>=';
const less_or_equal = '<=';
const equal = '=';

const comparisonOperators = [
  greater_than,
  less_than,
  greater_or_equal,
  less_or_equal,
];

// helpers (no side effects)

const isMin = (operator) => {
  // the value being compared is the lower bound
  if ([greater_than, greater_or_equal].includes(operator)) {
    return true;
  }
  // the value being compared is the upper bound
  if ([less_than, less_or_equal].includes(operator)) {
    return false;
  }
  // should not happen; isMin should only be called with comparison operators
  return undefined;
};

const getConstraints = (columnRef) => (min, max) => {
  // NOTE: min and/or max can be undefined
  return {
    name: columnRef,
    min,
    max,
  };
};

const getCol = (node) => {
  let { type: nodeType, expr, column } = node;
  if (nodeType === cast) {
    return expr.column;
  }
  if (nodeType === column_ref) {
    return column;
  }
};

function compareValues(a, b) {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

const getValues = (node) => {
  let { type: nodeType, value } = node;
  if (nodeType === expr_list) {
    // value should be an array of value objects
    // such as { type: 'number', value: -2.5 }
    // or { type: 'string', value: '2020-08-09' }
    // both types can be sorted to return the min on the left
    // and the max on the right
    return value.map(({ value: v }) => v).sort(compareValues);
  }
  return [];
};

const getValue = (node) => {
  let { type: nodeType, value } = node;
  if (nodeType === 'number' || nodeType === 'string') {
    return value;
  }
  moduleLogger.warn('unexpected value type', { nodeType, node });
  return null;
};

const getAst = (queryString) => {
  let result = queryToAST(queryString);

  return result && result.parserResult && result.parserResult.ast;
};

const extractConstraintsFromSelect = (ast) => {
  let { type: queryType, where: whereRoot } = ast;

  if (queryType !== 'select') {
    return null;
  }

  if (!whereRoot) {
    return null;
  }

  // console.log(JSON.stringify(whereRoot, null, 2));

  // examineNod :: Node -> Constraint
  // Constraint :: { name: String, min: any, max: any }
  const examineNode = (node) => {
    let { type: nodeType, operator, left, right } = node;

    // the base case is a penultimate node, a node before a leaf,
    // because returning a Constraint involves matching the column ref
    // in the Left leaf with the Values in the Right leaf

    // base case: BETWEEN
    if (nodeType === binary_expr && operator === BETWEEN) {
      let col = getCol(left);
      let [min, max] = getValues(right);
      return [getConstraints(col)(min, max)];
    }

    if (
      nodeType === 'unary_expr' &&
      operator === 'NOT' &&
      node.expr &&
      node.expr.type === binary_expr &&
      node.expr.operator === BETWEEN &&
      getCol(node.expr.left) === 'lon'
    ) {
      const [min, max] = getValues(node.expr.right);
      if (typeof min === 'number' && typeof max === 'number') {
        return [{ name: 'lon', notBetween: { min, max } }];
      }
    }

    if (nodeType === binary_expr && comparisonOperators.includes(operator)) {
      let col = getCol(left);
      let value = getValue(right);
      let valueIsMin = isMin(operator);
      let min = valueIsMin ? value : undefined;
      let max = valueIsMin ? undefined : value;
      return [getConstraints(col)(min, max)];
    }

    if (nodeType === binary_expr && operator === equal) {
      let col = getCol(left);
      let value = getValue(right);
      // min and max are identical if operator is '='
      return [getConstraints(col)(value, value)];
    }

    // keep going: AND
    if (nodeType === binary_expr && operator === AND) {
      let resultLeft = [];
      let resultRight = [];

      if (left) {
        resultLeft = examineNode(left);
      }
      if (right) {
        resultRight = examineNode(right);
      }

      return [...resultLeft, ...resultRight];
    }

    // else
    return [];

    // TODO handle 'IS_NOT' operator
  };

  let constraintsList = examineNode(whereRoot);

  let template = {
    time: {},
    lat: {},
    lon: {},
    depth: {},
  };
  let constraints = constraintsList.reduce((acc, curr) => {
    let { name, min, max, notBetween } = curr;

    if (!['time', 'lat', 'lon', 'depth', 'month'].includes(name)) {
      // don't accumulate non-geospatial constraints
      return acc;
    }

    if (!acc[name]) {
      acc[name] = {};
    }
    if (notBetween) {
      acc[name].notBetween = notBetween;
      return acc;
    }
    // min can be 0
    if (typeof min === 'number' || typeof min === 'string') {
      acc[name].min = min;
    }
    if (max) {
      acc[name].max = max;
    }

    return acc;
  }, template);

  if (constraints.month) {
    constraints.time = constraints.month;
    delete constraints.month;
  }

  moduleLogger.debug('CONSTRAINTS', constraints);

  return constraints;
};

const findUnionSelect = (ast) => {
  if (!ast || ast.type !== 'select') {
    return null;
  }

  if (ast.set_op && ast._next) {
    return ast;
  }

  for (const fromItem of ast.from || []) {
    const nestedSelect = fromItem.expr && fromItem.expr.ast;
    const unionSelect = findUnionSelect(nestedSelect);
    if (unionSelect) {
      return unionSelect;
    }
  }

  return null;
};

// MinMax k :: { min: any k, max: any k }
// Constraints :: { time: MinMax, lat: MinMax, lon: MinMax, depth: MinMax }
function extractQueryConstraints(queryString = '') {
  const ast = getAst(queryString);
  return ast ? extractConstraintsFromSelect(ast) : null;
}

function extractQueryConstraintGroups(queryString = '') {
  const ast = getAst(queryString);
  const unionSelect = findUnionSelect(ast);
  if (!unionSelect) {
    return null;
  }

  const branches = [];
  let branch = unionSelect;
  while (branch) {
    if (branch.type !== 'select') {
      return null;
    }
    branches.push(branch);
    branch = branch._next;
  }

  if (branches.length < 2) {
    return null;
  }

  const groups = branches.map(extractConstraintsFromSelect);
  return groups.every((constraints) => constraints !== null) ? groups : null;
}

module.exports = {
  extractQueryConstraints,
  extractQueryConstraintGroups,
};
