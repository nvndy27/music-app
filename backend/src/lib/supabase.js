const env = require("../config/env");
const { ApiError } = require("../shared/http");

function ensureSupabaseConfig() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new ApiError(
      500,
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env"
    );
  }
}

function buildUrl(path, params = {}) {
  ensureSupabaseConfig();
  const baseUrl = env.supabaseUrl.replace(/\/$/, "");
  const url = new URL(`${baseUrl}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return url;
}

async function supabaseFetch(path, options = {}) {
  ensureSupabaseConfig();

  const url = typeof path === "string" ? buildUrl(path, options.params) : path;
  const headers = {
    apikey: env.supabaseServiceRoleKey,
    Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    data = text ? { message: text } : null;
  }

  if (!response.ok) {
    throw new ApiError(response.status, data?.message || data?.error || "Supabase request failed", data);
  }

  return data;
}

function getPublicStorageUrl(bucket, path) {
  const baseUrl = env.supabaseUrl.replace(/\/$/, "");
  return `${baseUrl}/storage/v1/object/public/${bucket}/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
}

async function checkSupabaseConnection() {
  const rows = await supabaseFetch("/rest/v1/tracks", {
    params: {
      select: "id",
      limit: "1",
    },
  });

  return {
    connected: true,
    projectUrl: env.supabaseUrl,
    tracksTableReachable: Array.isArray(rows),
  };
}

async function getSupabaseUser(accessToken) {
  return supabaseFetch("/auth/v1/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

module.exports = {
  supabaseFetch,
  getPublicStorageUrl,
  checkSupabaseConnection,
  getSupabaseUser,
};
