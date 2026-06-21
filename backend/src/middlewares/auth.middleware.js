const { ApiError } = require("../shared/http");
const { getSupabaseUser } = require("../lib/supabase");

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      throw new ApiError(401, "Authentication token is required");
    }

    const user = await getSupabaseUser(token);
    req.user = {
      id: user.id,
      email: user.email,
      displayName: user.user_metadata?.display_name || user.user_metadata?.full_name || user.email,
      avatarUrl: user.user_metadata?.avatar_url || null,
      role: user.app_metadata?.role || "listener",
    };
    next();
  } catch (error) {
    next(new ApiError(401, "Invalid or expired Supabase session"));
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
