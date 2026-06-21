const SESSION_STORAGE_KEY = "pulse-music-auth-session";
// Supabase publishable keys are intended to run in the browser. Keeping this
// public configuration with the static app avoids making sign-in depend on a
// separate backend deployment being awake or reachable.
const SUPABASE_AUTH_CONFIG = {
  url: "https://ijdyeiamfqimpchlnufd.supabase.co",
  publishableKey: "sb_publishable_kd0xKpOFrcWJ35CQBUlbiw_72QBurBj",
};
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
let supabasePromise = null;
let isRegistering = false;
let guestAccess = false;
let authSubscription = null;

function logAuth(action, details = {}) {
  console.info("[auth]", action, details);
}

function authError(action, error) {
  console.error("[auth]", action, error);
}

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

function getAuthConfig() {
  if (window.MUSIC_SUPABASE_URL && window.MUSIC_SUPABASE_PUBLISHABLE_KEY) {
    return {
      url: window.MUSIC_SUPABASE_URL,
      publishableKey: window.MUSIC_SUPABASE_PUBLISHABLE_KEY,
    };
  }

  return SUPABASE_AUTH_CONFIG;
}

function setMessage(message = "", isError = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle("error", isError);
}

function setBusy(isBusy) {
  authSubmit.disabled = isBusy;
  googleSignIn.disabled = isBusy;
  authSwitch.disabled = isBusy;
  // Skip login deliberately stays enabled so a slow or failed network request never traps the user.
}

function clearOAuthUrl() {
  const url = new URL(window.location.href);
  const authParams = ["code", "error", "error_code", "error_description", "access_token", "refresh_token", "expires_in", "token_type", "type"];
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

  if (changed) window.history.replaceState({}, document.title, url.pathname + url.search);
}

function setMode(registering) {
  isRegistering = registering;
  authNameField.hidden = !registering;
  authName.required = registering;
  authPassword.autocomplete = registering ? "new-password" : "current-password";
  authEmail.type = "email";
  authEmail.autocomplete = "email";
  authEmail.placeholder = "you@example.com";
  if (authEmailLabel) authEmailLabel.textContent = "Email";
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
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function setStoredSession(session) {
  try {
    if (!session) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    authError("session-storage", error);
  }
}

function saveUserSession(user, mode) {
  setStoredSession({ mode, user });
}

function showApp(user, mode = "authenticated") {
  const name = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email || "Listener";
  const nameTarget = profileButton.querySelector("span");
  if (nameTarget) nameTarget.textContent = name;

  const wasAuthenticated = document.body.classList.contains("authenticated");
  document.body.classList.remove("auth-pending");
  document.body.classList.add("authenticated");
  authScreen.hidden = true;
  logAuth("app-opened", { mode, userId: user?.id || user?.email || "guest" });
  if (!wasAuthenticated) {
    window.dispatchEvent(new CustomEvent("music:authenticated", { detail: { user, mode } }));
  }
}

async function initializeSupabase() {
  if (supabase) return supabase;
  if (supabasePromise) return supabasePromise;

  supabasePromise = (async () => {
    const [config] = await Promise.all([Promise.resolve(getAuthConfig()), loadSupabaseClient()]);
    if (!window.supabase?.createClient) throw new Error("The authentication client is not available.");

    supabase = window.supabase.createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: window.localStorage,
        storageKey: "pulse-music-auth",
      },
    });

    return supabase;
  })();

  try {
    return await supabasePromise;
  } catch (error) {
    supabasePromise = null;
    throw error;
  }
}

function subscribeToAuth(client) {
  if (authSubscription) return;

  const { data } = client.auth.onAuthStateChange((event, session) => {
    logAuth("state-changed", { event, hasSession: Boolean(session?.user) });
    if (guestAccess || !session?.user) return;
    saveUserSession(session.user, "authenticated");
    showApp(session.user);
  });
  authSubscription = data.subscription;
}

async function initializeAuth() {
  const storedSession = getStoredSession();
  if (storedSession?.mode === "guest" && storedSession.user) {
    guestAccess = true;
    showApp(storedSession.user, "guest");
    return;
  }

  try {
    const client = await initializeSupabase();
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error_description") || params.get("error");
    if (oauthError) throw new Error(oauthError);

    const code = params.get("code");
    if (code) {
      logAuth("google-callback-received");
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error) throw error;
      clearOAuthUrl();
      if (data.session?.user) {
        saveUserSession(data.session.user, "authenticated");
        showApp(data.session.user);
        return;
      }
    }

    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    subscribeToAuth(client);

    if (session?.user) {
      saveUserSession(session.user, "authenticated");
      showApp(session.user);
      return;
    }

    authScreen.hidden = false;
    document.body.classList.add("auth-pending");
    logAuth("ready-for-sign-in");
  } catch (error) {
    authError("initialization-failed", error);
    clearOAuthUrl();
    authScreen.hidden = false;
    document.body.classList.add("auth-pending");
    setMessage(error.message || "Sign-in is unavailable. You can still choose Skip login.", true);
  } finally {
    setBusy(false);
  }
}

function validateCredentials() {
  const email = authEmail.value.trim().toLowerCase();
  const password = authPassword.value;
  const name = authName.value.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (isRegistering && name.length < 2) throw new Error("Please enter a name with at least 2 characters.");
  if (!emailPattern.test(email)) throw new Error("Please enter a valid email address.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");
  return { email, password, name };
}

async function completeAuthentication(session) {
  if (!session?.user) throw new Error("Authentication succeeded but no user session was returned.");
  guestAccess = false;
  saveUserSession(session.user, "authenticated");
  showApp(session.user);
}

async function startGuestMode() {
  const guestUser = {
    id: "guest",
    email: "guest@pulse.local",
    user_metadata: { display_name: "Guest" },
  };

  guestAccess = true;
  setBusy(false);
  setMessage();
  clearOAuthUrl();
  saveUserSession(guestUser, "guest");
  logAuth("guest-login");
  showApp(guestUser, "guest");
}

authSwitch.addEventListener("click", () => {
  logAuth("mode-changed", { mode: isRegistering ? "login" : "register" });
  setMode(!isRegistering);
});

authSkip.addEventListener("click", startGuestMode);

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(true);
  setMessage();

  try {
    const { email, password, name } = validateCredentials();
    const client = await initializeSupabase();
    subscribeToAuth(client);
    logAuth(isRegistering ? "registration-started" : "login-started", { email });

    const result = isRegistering
      ? await client.auth.signUp({
          email,
          password,
          options: { data: { username: name, display_name: name } },
        })
      : await client.auth.signInWithPassword({ email, password });

    if (result.error) throw result.error;
    if (result.data.session?.user) {
      await completeAuthentication(result.data.session);
      return;
    }

    if (isRegistering) {
      throw new Error("Account created. Confirm your email, then sign in to continue.");
    }
    throw new Error("Sign-in did not return a session. Please try again.");
  } catch (error) {
    authError(isRegistering ? "registration-failed" : "login-failed", error);
    setMessage(error.message || "Could not authenticate. Please try again.", true);
  } finally {
    setBusy(false);
  }
});

googleSignIn.addEventListener("click", async () => {
  setBusy(true);
  setMessage();

  try {
    const client = await initializeSupabase();
    subscribeToAuth(client);
    logAuth("google-login-started");
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) throw error;
  } catch (error) {
    authError("google-login-failed", error);
    setBusy(false);
    setMessage(error.message || "Google sign-in could not start. Please try again or choose Skip login.", true);
  }
});

profileButton.addEventListener("click", async () => {
  if (!document.body.classList.contains("authenticated")) return;

  logAuth("sign-out");
  guestAccess = false;
  setStoredSession(null);

  try {
    if (supabase) await supabase.auth.signOut();
  } catch (error) {
    authError("sign-out-failed", error);
  }

  window.location.reload();
});

setMode(false);
setBusy(false);
initializeAuth();
