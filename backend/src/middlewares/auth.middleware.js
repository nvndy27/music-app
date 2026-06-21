const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { ApiError } = require("../shared/http");
const userService = require("../modules/users/user.service");

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      throw new ApiError(401, "Authentication token is required");
    }

    const payload = jwt.verify(token, env.jwtSecret);
    const user = await userService.findById(payload.sub);

    if (!user) {
      throw new ApiError(401, "User no longer exists");
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      next(new ApiError(401, "Invalid or expired token"));
      return;
    }

    next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new ApiError(403, "You do not have permission to perform this action"));
      return;
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
};
