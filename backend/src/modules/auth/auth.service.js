const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");
const { ApiError } = require("../../shared/http");
const userService = require("../users/user.service");

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

async function register(payload) {
  const user = await userService.createUser(payload);
  const token = signToken(user);
  return { user, token };
}

async function login(payload) {
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const user = await userService.findPrivateByEmail(email);

  if (!user || !user.isActive) {
    throw new ApiError(401, "Invalid credentials");
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    throw new ApiError(401, "Invalid credentials");
  }

  const safeUser = userService.sanitize(user);
  const token = signToken(safeUser);
  return { user: safeUser, token };
}

module.exports = {
  register,
  login,
};
