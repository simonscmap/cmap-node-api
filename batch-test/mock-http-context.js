const createMockRequest = (body, reqId = null) => {
  return {
    body,
    reqId: reqId || `test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
  };
};

const createMockResponse = () => {
  const mockRes = {
    statusCode: 200,
    response: null,
    status: function(code) { 
      this.statusCode = code; 
      return this; 
    },
    json: function(data) { 
      this.response = data; 
      return this; 
    }
  };
  return mockRes;
};

module.exports = {
  createMockRequest,
  createMockResponse
};