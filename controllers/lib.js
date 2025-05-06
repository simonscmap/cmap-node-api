// library functions for use in controllers
let S = require('../utility/sanctuary');
let $ = require('sanctuary-def');
let Future = require('fluture');
let initializeLogger = require('../log-service');

let {
  either,
  ifElse,
  prop,
  Left,
  Right,
  pipe,
  Pair,
  fst,
  snd,
  find,
  map,
  chain,
  eitherToMaybe,
} = S;
let { resolve, reject, attemptP } = Future;

let log = initializeLogger('cotrollers/lib');

let trace = (x) => {
  log.debug('trace', x);
  return x;
};

// given an array of parsed args, find an arg by name
let findArgByName = (argName) =>
  pipe([
    find((el) => el.vName === argName), // -> Maybe (Argument Definition)
    map(prop('eitherVal')), // -> Maybe (Right (eitherVal))
    chain(eitherToMaybe), // -> Maybe (val)
  ]);

// Parse Args
// return query definition with resolved args
// note that the resolver can be anything,
// thus you can use parse args with something other than a request object
let parseArgs = (def) => (req) => {
  let parsedArgs = def.args.map((arg) => {
    return {
      ...arg,
      eitherVal: arg.resolver(req),
    };
  });

  return {
    ...def,
    args: parsedArgs,
  };
};

// Definition -> Request -> Either ParsedDefinition ErrorMessages
let parseQueryDefinition = (def) => (req) => {
  let parsedDef = parseArgs(def)(req);

  // when applied, this function will yield a string of error messages,
  // if any, or an empty string
  let errorMessages = pipe([
    prop('args'),
    S.filter(S.compose(S.isLeft)(S.prop('eitherVal'))),
    S.map(S.compose(S.fromLeft(''))(S.prop('eitherVal'))),
    S.joinWith(', '),
  ])(parsedDef);

  // decide to return Left of Right
  let nonEmptyErrorsArray = (messages) => messages.length > 0;

  // hydrate template
  // TODO handle failure of template execution
  let prepareTemplate = (def) => {
    return {
      ...def,
      template: def.template(def.args), // TODO should be a Maybe
    };
  };

  let RightOfDef = () => Right(prepareTemplate(parsedDef));
  // if there is an error parsing an argument, return status 400 and the error message(s)
  let LeftOfErrorMsg = (errorMessage) => Left(Pair(400)(errorMessage));

  // based on the existence of error messages, either
  // return Left or errors or Right of Def
  let result = pipe([ifElse(nonEmptyErrorsArray)(LeftOfErrorMsg)(RightOfDef)])(
    errorMessages,
  );

  return result;
};

// if error is a Pair of a status/message, extract it to a tuple
// default status to 400 for now
let parseError = (error) => {
  let msg = error;
  let status = 400;
  if (S.is($.Pair($.Integer)($.String))(error)) {
    msg = S.snd(error);
    status = S.fst(error);
  }
  return [status, msg];
};

// apply each value FROM A DEF to the query
let supplyInputFromDefinitionToQuery = (parsedDef) => (sqlRequest) => {
  parsedDef.args.forEach((argDef) => {
    let { vName, sqlType, defaultTo, eitherVal } = argDef;
    // if the arg has a SQL Type, then supply it to the query
    // otherwise assume that it is not meant to be parameterized
    if (sqlType) {
      let value = S.fromRight(defaultTo)(eitherVal);
      sqlRequest.input(vName, sqlType, value);
    }
  });
  // This needs to return both, because we need the query template
  // in order to run the sql request
  return Pair(sqlRequest)(parsedDef);
};

// Ethier (Definition, Error) -> Sql Request ->  Future (Pair (sqlRequest) (def))
let eitherSupplyInputOrReject = (eitherDefOrError) => (sqlRequest) => {
  let rejectOrResolve = either(reject)((def) =>
    resolve(supplyInputFromDefinitionToQuery(def)(sqlRequest)),
  );
  return rejectOrResolve(eitherDefOrError);
};

let pairRequestWithQDef = (qDef) => (request) => Pair(request)(qDef);

let executeRequest = (pair) =>
  attemptP(() => {
    let req = fst(pair);
    let def = snd(pair);
    return req.query(def.template);
  });

module.exports = {
  trace,
  findArgByName,
  parseArgs,
  parseQueryDefinition,
  parseError,
  supplyInputFromDefinitionToQuery,
  eitherSupplyInputOrReject,
  pairRequestWithQDef,
  executeRequest,
};
