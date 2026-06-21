const AUTH_API_BASE_URL = window.MUSIC_API_BASE_URL || "https://music-app-backend-cfue.onrender.com/api";
const SUPABASE_CLIENT_SOURCES = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
  "https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js",
];

const authScreen = document.querySelector("#authScreen");
const authForm = document.querySelector("#authForm");
const authTitle = document.querySelector("#authTitle");
const authCopy = document.querySelector("#authCopy");
const authNameField = document.querySelector("#authNameField");
const authName = document.querySelector("#authName");
const authEmail = document.querySelector("#authEmail");
const authPassword = document.querySelector("#authPassword");
const authEmailLabel = authEmail.closest(".auth-field")?.querySelector("span");
const authSubmit = document.querySelector("#authSubmit");
const authSwitch = document.querySelector("#authSwitch");
const authSkip = document.querySelector("#authSkip");
const authMessage = document.querySelector("#authMessage");
const googleSignIn = document.querySelector("#googleSignIn");
const profileButton = document.querySelector("#profileButton");

let supabase = null;
let isRegistering = false;
let guestAccess = false;

function loadScript(source, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeoutId = window.setTimeout(() => {
      script.remove();
      reject(new Error("Timed out while loading the authentication client."));
    }, timeoutMs);

    script.src = source;
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timeoutId);
      script.remove();
      reject(new Error("Could not load the authentication client."));
    };
    document.head.append(script);
  });
}

async function loadSupabaseClient() {
  if (window.supabase?.createClient) return;

  let lastError;
  for (const source of SUPABASE_CLIENT_SOURCES) {
    try {
      await loadScript(source);
      if (window.supabase?.createClient) return;
      lastError = new Error("The authentication client loaded with an invalid response.");
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Could not load the authentication client.");
}

async function fetchAuthConfig() {
  const response = await fetch(`${AUTH_API_BASE_URL}/auth/config`);
  const payload = await response.json();

  if (!response.ok || !payload.data?.url || !payload.data?.publishableKey) {
    throw new Error(payload.message || "Supabase Auth is not configured.");
  }

  return payload.data;
}

function setMessage(message = "", isError = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle("error", isError);
}

function setBusy(isBusy) {
  authSubmit.disabled = isBusy;
  googleSignIn.disabled = isBusy;
  authSwitch.disabled = isBusy;
}

function clearOAuthUrl() {
  const url = new URL(window.location.href);
  const authParams = [
    "code",
    "error",
    "error_code",
    "error_description",
    "access_token",
    "refresh_token",
    "expires_in",
    "token_type",
    "type",
  ];

  let changed = false;
  authParams.forEach((param) => {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      changed = true;
    }
  });

  if (window.location.hash) {
    url.hash = "";
    changed = true;
  }

  if (changed) {
    window.history.replaceState({}, document.title, url.pathname + url.search);
  }
}

function setMode(registering) {
  isRegistering = registering;
  authNameField.hidden = !registering;
  authName.required = registering;
  authPassword.autocomplete = registering ? "new-password" : "current-password";
  authEmail.type = registering ? "email" : "text";
  authEmail.autocomplete = registering ? "email" : "username";
  authEmail.placeholder = registering ? "you@example.com" : "username";
  if (authEmailLabel) authEmailLabel.textContent = registering ? "Email" : "Username";
  authTitle.textContent = registering ? "Create your account" : "Welcome back";
  authCopy.textContent = registering
    ? "Save your library and keep listening across devices."
    : "Sign in to listen to your library.";
  authSubmit.textContent = registering ? "Create account" : "Sign in";
  authSwitch.textContent = registering ? "Already have an account? Sign in" : "New here? Create an account";
  setMessage();
}

function getStoredSession() {
  try {
    const raw = window.localStorage.getItem("pulse-music-auth-session");
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function setStoredSession(session) {
  try {
    if (!session) {
      window.localStorage.removeItem("pulse-music-auth-session");
      return;
    }

    window.localStorage.setItem("pulse-music-auth-session", JSON.stringify(session));
  } catch (error) {
    // Storage is best-effort only.
  }
}

function showApp(user) {
  const name = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email || "Listener";
  const nameTarget = profileButton.querySelector("span");
  if (nameTarget) nameTarget.textContent = name;

  document.body.classList.remove("auth-pending");
  document.body.classList.add("authenticated");
  authScreen.hidden = true;
  window.dispatchEvent(new CustomEvent("music:authenticated", { detail: { user } }));
}

async function initializeSupabase() {
  const [config] = await Promise.allSettled([fetchAuthConfig(), loadSupabaseClient()]);

  if (config.status !== "fulfilled" || !window.supabase?.createClient) {
    throw config.status === "rejected"
      ? config.reason
      : new Error("The authentication client is not available.");
  }

  supabase = window.supabase.createClient(config.value.url, config.value.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
      storageKey: "pulse-music-auth",
    },
  });

  return supabase;
}

async function initializeAuth() {
  try {
    const storedSession = getStoredSession();
    if (storedSession?.user) {
      showApp(storedSession.user);
      return;
    }

    const client = await initializeSupabase();

    if (guestAccess) return;

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has("error_description")) {
      throw new Error(searchParams.get("error_description"));
    }

    if (searchParams.has("code")) {
      const { error } = await client.auth.exchangeCodeForSession(window.location.href);
      if (error) throw error;
      clearOAuthUrl();
    }

    const { data: { session }, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;

    if (guestAccess) return;

    if (session?.user) {
      setStoredSession(session);
      showApp(session.user);
      return;
    }

    authScreen.hidden = false;
    document.body.classList.add("auth-pending");

    client.auth.onAuthStateChange((_event, sessionState) => {
      if (sessionState?.user && !guestAccess) {
        setStoredSession(sessionState);
        showApp(sessionState.user);
      }
    });
  } catch (error) {
    if (guestAccess) return;

    authScreen.hidden = false;
    document.body.classList.add("auth-pending");
    clearOAuthUrl();
    setMessage(`Authentication is not ready yet: ${error.message || "check the Supabase setup."}`, true);
  }
}

async function applySession(session) {
  if (!session) {
    throw new Error("Authentication succeeded but no session was returned.");
  }

  setStoredSession(session);

  if (supabase && session.access_token && session.refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });

    if (error) throw error;
    if (data.session?.user) {
      showApp(data.session.user);
      return;
    }
  }

  if (session.user) {
    showApp(session.user);
    return;
  }

  throw new Error("Authentication succeeded but no user was returned.");
}

async function startGuestMode() {
  guestAccess = true;
  setBusy(false);
  setMessage();
  clearOAuthUrl();
  showApp({
    email: "guest@pulse.local",
    user_metadata: { display_name: "Guest" },
  });
}

authSwitch.addEventListener("click", () => setMode(!isRegistering));

authSkip.addEventListener("click", startGuestMode);

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  setBusy(true);
  setMessage();

  try {
    const password = authPassword.value;
    const endpoint = isRegistering ? "register" : "login";
    const body = isRegistering
      ? { username: authName.value.trim(), email: authEmail.value.trim(), password }
      : { username: authEmail.value.trim(), password };

    const response = await fetch(`${AUTH_API_BASE_URL}/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error?.message || "Could not authenticate. Please try again.");
    }

    await applySession(payload.data);
  } catch (error) {
    setMessage(error.message || "Could not authenticate. Please try again.", true);
  } finally {
    setBusy(false);
  }
});

googleSignIn.addEventListener("click", async () => {
  setBusy(true);
  setMessage();

  try {
    if (!supabase) {
      await initializeSupabase();
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) throw error;
  } catch (error) {
    setBusy(false);
    setMessage(error.message || "Google sign-in could not start.", true);
  }
});

profileButton.addEventListener("click", async () => {
  if (!document.body.classList.contains("authenticated")) return;

  setStoredSession(null);

  if (supabase) {
    await supabase.auth.signOut();
  }

  window.location.reload();
});

setMode(false);
setBusy(false);
initializeAuth();
