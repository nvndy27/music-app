const env = require("../config/env");
const { ApiError } = require("../shared/http");

function requireAdminKey(req, res, next) {
  const authorization = req.headers.authorization || "";
  const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const key = req.headers["x-admin-key"] || bearerToken;

  if (!key || key !== env.adminUploadKey) {
    next(new ApiError(401, "Admin upload key is required"));
    return;
  }

  next();
}

module.exports = {
  requireAdminKey,
};
