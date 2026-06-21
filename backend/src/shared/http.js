class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function sendCreated(res, data) {
  return res.status(201).json({ data });
}

function sendOk(res, data) {
  return res.status(200).json({ data });
}

module.exports = {
  ApiError,
  asyncHandler,
  sendCreated,
  sendOk,
};
