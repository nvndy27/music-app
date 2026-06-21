const { ApiError, asyncHandler, sendOk } = require("../../shared/http");

const register = asyncHandler(async () => {
  throw new ApiError(410, "Register through Supabase Auth in the web client");
});

const login = asyncHandler(async () => {
  throw new ApiError(410, "Log in through Supabase Auth in the web client");
});

const me = asyncHandler(async (req, res) => {
  sendOk(res, req.user);
});

const config = asyncHandler(async (req, res) => {
  const env = require("../../config/env");

  if (!env.supabaseUrl || !env.supabasePublishableKey) {
    throw new ApiError(500, "Supabase Auth is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.");
  }

  sendOk(res, {
    url: env.supabaseUrl,
    publishableKey: env.supabasePublishableKey,
  });
});

module.exports = {
  register,
  login,
  me,
  config,
};
