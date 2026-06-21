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

async function listSupabaseUsers() {
  const users = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const data = await supabaseFetch("/auth/v1/admin/users", {
      params: {
        page: String(page),
        per_page: String(perPage),
      },
    });

    const rows = Array.isArray(data?.users) ? data.users : [];
    users.push(...rows);

    if (rows.length < perPage) break;
    page += 1;
  }

  return users;
}

async function createSupabaseUser({ email, password, username }) {
  return supabaseFetch("/auth/v1/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        display_name: username,
      },
    }),
  });
}

async function signInSupabaseUser(email, password) {
  const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: env.supabasePublishableKey || env.supabaseServiceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(response.status, data?.error_description || data?.msg || data?.message || "Supabase sign-in failed", data);
  }

  return data;
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
  listSupabaseUsers,
  createSupabaseUser,
  signInSupabaseUser,
  getSupabaseUser,
};
