const { ApiError } = require("../shared/http");
const env = require("../config/env");

function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;
  const payload = {
    error: {
      message: error.message || "Internal server error",
      statusCode,
    },
  };

  if (error.details) {
    payload.error.details = error.details;
  }

  if (env.nodeEnv === "development") {
    payload.error.stack = error.stack;
  }

  res.status(statusCode).json(payload);
}

module.exports = {
  notFound,
  errorHandler,
};
