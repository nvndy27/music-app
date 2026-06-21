const { ApiError, asyncHandler, sendCreated, sendOk } = require("../../shared/http");
const { createSupabaseUser, listSupabaseUsers, signInSupabaseUser } = require("../../lib/supabase");

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function userUsername(user) {
  return normalizeUsername(user?.user_metadata?.username || user?.user_metadata?.display_name);
}

async function findUserByUsername(username) {
  const normalizedUsername = normalizeUsername(username);
  const users = await listSupabaseUsers();
  return users.find((user) => userUsername(user) === normalizedUsername) || null;
}

const register = asyncHandler(async (req, res) => {
  const username = normalizeUsername(req.body.username || req.body.displayName || req.body.name);
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!username || !email || !password) {
    throw new ApiError(400, "Username, email, and password are required");
  }

  if (password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters");
  }

  const users = await listSupabaseUsers();
  if (users.some((user) => userUsername(user) === username)) {
    throw new ApiError(409, "Username is already taken");
  }

  if (users.some((user) => String(user.email || "").toLowerCase() === email)) {
    throw new ApiError(409, "Email is already registered");
  }

  await createSupabaseUser({ email, password, username });
  const session = await signInSupabaseUser(email, password);
  sendCreated(res, session);
});

const login = asyncHandler(async (req, res) => {
  const username = normalizeUsername(req.body.username || req.body.email);
  const password = String(req.body.password || "");

  if (!username || !password) {
    throw new ApiError(400, "Username and password are required");
  }

  const user = await findUserByUsername(username);
  if (!user?.email) {
    throw new ApiError(401, "Invalid username or password");
  }

  const session = await signInSupabaseUser(user.email, password);
  sendOk(res, session);
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
