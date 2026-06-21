const AUTH_API_BASE_URL = window.MUSIC_API_BASE_URL || "http://localhost:4000/api";

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
  try {
    const response = await fetch(`${AUTH_API_BASE_URL}/auth/config`);
    const payload = await response.json();

    if (!response.ok || !payload.data?.url || !payload.data?.publishableKey) {
      throw new Error(payload.message || "Supabase Auth is not configured.");
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
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) showAuthenticated(session.user);

    supabase.auth.onAuthStateChange((_event, sessionState) => {
      if (sessionState?.user) showAuthenticated(sessionState.user);
    });
  } catch (error) {
    setMessage("Authentication is not ready yet. Check the Supabase setup.", true);
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
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + window.location.pathname },
  });

  if (error) {
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
