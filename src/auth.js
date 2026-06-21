const AUTH_API_BASE_URL = window.MUSIC_API_BASE_URL || "https://music-app-backend-cfue.onrender.com/api";

const authScreen = document.querySelector("#authScreen");
const authForm = document.querySelector("#authForm");
const authTitle = document.querySelector("#authTitle");
const authCopy = document.querySelector("#authCopy");
const authNameField = document.querySelector("#authNameField");
const authName = document.querySelector("#authName");
const authEmail = document.querySelector("#authEmail");
const authPassword = document.querySelector("#authPassword");
const authSubmit = document.querySelector("#authSubmit");
const authSwitch = document.querySelector("#authSwitch");
const authMessage = document.querySelector("#authMessage");
const googleSignIn = document.querySelector("#googleSignIn");
const profileButton = document.querySelector("#profileButton");

let supabase = null;
let isRegistering = false;

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
  authTitle.textContent = registering ? "Create your account" : "Welcome back";
  authCopy.textContent = registering
    ? "Save your library and keep listening across devices."
    : "Sign in to listen to your library.";
  authSubmit.textContent = registering ? "Create account" : "Sign in";
  authSwitch.textContent = registering ? "Already have an account? Sign in" : "New here? Create an account";
  setMessage();
}

function showAuthenticated(user) {
  const name = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email || "Listener";
  const nameTarget = profileButton.querySelector("span");
  if (nameTarget) nameTarget.textContent = name;

  document.body.classList.remove("auth-pending");
  document.body.classList.add("authenticated");
  authScreen.hidden = true;
  window.dispatchEvent(new CustomEvent("music:authenticated", { detail: { user } }));
}

async function initializeAuth() {
  setBusy(true);

  try {
    const response = await fetch(`${AUTH_API_BASE_URL}/auth/config`);
    const payload = await response.json();

    if (!response.ok || !payload.data?.url || !payload.data?.publishableKey) {
      throw new Error(payload.message || "Supabase Auth is not configured.");
    }

    if (!window.supabase?.createClient) {
      throw new Error("Supabase client script did not load.");
    }

    supabase = window.supabase.createClient(payload.data.url, payload.data.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: "pulse-music-auth",
      },
    });
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has("error_description")) {
      throw new Error(searchParams.get("error_description"));
    }

    if (searchParams.has("code")) {
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
      if (error) throw error;
      clearOAuthUrl();
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    if (session?.user) {
      showAuthenticated(session.user);
    } else {
      authScreen.hidden = false;
      document.body.classList.add("auth-pending");
      setBusy(false);
    }

    supabase.auth.onAuthStateChange((_event, sessionState) => {
      if (sessionState?.user) {
        showAuthenticated(sessionState.user);
      }
    });
  } catch (error) {
    authScreen.hidden = false;
    document.body.classList.add("auth-pending");
    setBusy(false);
    clearOAuthUrl();
    setMessage(`Authentication is not ready yet: ${error.message || "check the Supabase setup."}`, true);
  }
}

authSwitch.addEventListener("click", () => setMode(!isRegistering));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return setMessage("Authentication is not available yet.", true);

  setBusy(true);
  setMessage();

  try {
    const email = authEmail.value.trim();
    const password = authPassword.value;
    const result = isRegistering
      ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: authName.value.trim() } },
        })
      : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) throw result.error;

    if (result.data.session?.user) {
      showAuthenticated(result.data.session.user);
      return;
    }

    if (isRegistering && !result.data.session) {
      setMessage("Check your email to confirm the new account, then sign in.");
    }
  } catch (error) {
    setMessage(error.message || "Could not authenticate. Please try again.", true);
  } finally {
    setBusy(false);
  }
});

googleSignIn.addEventListener("click", async () => {
  if (!supabase) return setMessage("Authentication is not available yet.", true);

  setBusy(true);
  setMessage();

  try {
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
  if (!supabase || !document.body.classList.contains("authenticated")) return;
  await supabase.auth.signOut();
  window.location.reload();
});

setMode(false);
initializeAuth();
