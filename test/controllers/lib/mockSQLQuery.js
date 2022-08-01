let createMockRequest = (mockPool) => {
  let context = {
    mockPool,
    args: {}
  };

  let MockRequest = {};

  MockRequest.getContext = () => context;

  MockRequest.input = (name, sqlType, val) => {
    context.args[name] = () => ({ sqlType, val });
  }

  MockRequest.query = (queryTemplate) => {
    return Promise.resolve(queryTemplate);
  }

  return MockRequest;
}

module.exports = createMockRequest;
