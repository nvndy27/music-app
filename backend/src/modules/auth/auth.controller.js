const authService = require("./auth.service");
const { asyncHandler, sendCreated, sendOk } = require("../../shared/http");

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  sendCreated(res, result);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  sendOk(res, result);
});

const me = asyncHandler(async (req, res) => {
  sendOk(res, req.user);
});

module.exports = {
  register,
  login,
  me,
};
