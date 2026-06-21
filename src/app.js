const API_BASE_URL = window.MUSIC_API_BASE_URL || "http://localhost:4000/api";

const albumGrid = document.querySelector("#albumGrid");
const trackTable = document.querySelector("#trackTable");
const quickGrid = document.querySelector(".quick-grid");
const filterButtons = document.querySelectorAll(".filter-pill");
const searchInput = document.querySelector("#searchInput");
const playerTitle = document.querySelector("#playerTitle");
const playerArtist = document.querySelector("#playerArtist");
const playerCover = document.querySelector("#playerCover");
const playerPlay = document.querySelector("#playerPlay");
const heroPlay = document.querySelector("#heroPlay");
const likeButton = document.querySelector("#likeButton");
const progressInput = document.querySelector("#progressInput");
const elapsedTime = document.querySelector("#elapsedTime");
const durationTime = document.querySelector("#durationTime");

let tracks = [];
let currentMood = "all";
let currentTrackId = null;
let isPlaying = false;
let progressSeconds = 0;
let timerId = null;

function icon(name) {
  return `<svg><use href="#icon-${name}"></use></svg>`;
}

function escapeHtml(value) {
  return String(value || "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]
  );
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safeSeconds / 60);
  const secs = String(safeSeconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function resolveMediaUrl(path) {
  if (!path) return "";

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `http://localhost:4000${path.startsWith("/") ? path : `/${path}`}`;
}

function artworkStyle(track) {
  const imageUrl = resolveMediaUrl(track.coverImageUrl || track.coverUrl);

  if (!imageUrl) {
    return "";
  }

  const safeImageUrl = encodeURI(imageUrl).replace(/'/g, "%27");
  return ` style="background-image: url('${safeImageUrl}'); background-size: cover; background-position: center;"`;
}

function applyArtwork(element, track) {
  const imageUrl = resolveMediaUrl(track.coverImageUrl || track.coverUrl);
  element.style.backgroundImage = imageUrl
    ? `url("${encodeURI(imageUrl).replace(/"/g, "%22")}")`
    : "";
  element.style.backgroundSize = imageUrl ? "cover" : "";
  element.style.backgroundPosition = imageUrl ? "center" : "";
}

function getCurrentTrack() {
  return tracks.find((track) => track.id === currentTrackId) || null;
}

function setPlayIcons() {
  const nextIcon = isPlaying ? icon("pause") : icon("play");
  playerPlay.innerHTML = nextIcon;
  heroPlay.innerHTML = nextIcon;
  playerPlay.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
  heroPlay.setAttribute("aria-label", isPlaying ? "Pause playlist" : "Play playlist");
}

function setCatalogState(message, state = "empty") {
  const stateMarkup = `<p class="catalog-state ${state}">${escapeHtml(message)}</p>`;
  albumGrid.innerHTML = stateMarkup;
  trackTable.innerHTML = stateMarkup;
  quickGrid.innerHTML = "";
}

async function loadTracks() {
  setCatalogState("Loading your music library...", "loading");

  try {
    const response = await fetch(`${API_BASE_URL}/music/tracks`);

    if (!response.ok) {
      throw new Error(`Catalog request failed with ${response.status}`);
    }

    const payload = await response.json();
    tracks = Array.isArray(payload.data) ? payload.data : [];

    if (tracks.length === 0) {
      currentTrackId = null;
      setCatalogState("Your music library is empty. Upload or create a track in the backend.");
      resetPlayer();
      return;
    }

    currentTrackId = tracks[0].id;
    setCurrentTrack(currentTrackId, false);
    renderAll();
  } catch (error) {
    console.error("Unable to load tracks from the backend:", error);
    currentTrackId = null;
    resetPlayer();
    setCatalogState(
      "Unable to reach the music API. Start the backend at http://localhost:4000.",
      "error"
    );
  }
}

function resetPlayer() {
  playerTitle.textContent = "No track selected";
  playerArtist.textContent = "Music library";
  durationTime.textContent = "0:00";
  elapsedTime.textContent = "0:00";
  progressInput.value = 0;
  playerCover.className = "mini-cover cover-gradient-2";
  isPlaying = false;
  setPlayIcons();
}

function setCurrentTrack(trackId, shouldPlay = true) {
  const track = tracks.find((item) => item.id === trackId);

  if (!track) {
    return;
  }

  currentTrackId = track.id;
  playerTitle.textContent = track.title;
  playerArtist.textContent = track.artist;
  durationTime.textContent = formatTime(track.duration ?? track.durationSeconds);
  progressSeconds = 0;
  progressInput.value = 0;
  elapsedTime.textContent = "0:00";
  playerCover.className = "mini-cover cover-gradient-2";
  applyArtwork(playerCover, track);

  if (shouldPlay) {
    isPlaying = true;
    startTimer();
    registerPlay(track.id);
  }

  setPlayIcons();
  renderTracks();
}

async function registerPlay(trackId) {
  try {
    await fetch(`${API_BASE_URL}/music/tracks/${trackId}/play`, {
      method: "POST",
    });
  } catch (error) {
    console.warn("Could not record play count:", error);
  }
}

function startTimer() {
  window.clearInterval(timerId);
  timerId = window.setInterval(() => {
    if (!isPlaying) return;

    const track = getCurrentTrack();

    if (!track) {
      return;
    }

    const duration = Number(track.duration ?? track.durationSeconds) || 0;
    progressSeconds = Math.min(progressSeconds + 1, duration);
    progressInput.value = duration ? Math.round((progressSeconds / duration) * 100) : 0;
    elapsedTime.textContent = formatTime(progressSeconds);

    if (duration && progressSeconds >= duration) {
      const currentIndex = tracks.findIndex((item) => item.id === currentTrackId);
      const nextTrack = tracks[(currentIndex + 1) % tracks.length];
      setCurrentTrack(nextTrack.id, true);
    }
  }, 1000);
}

function togglePlay() {
  if (!getCurrentTrack()) {
    return;
  }

  isPlaying = !isPlaying;
  setPlayIcons();

  if (isPlaying) {
    startTimer();
  }
}

function matchesQuery(track, query) {
  const source = [track.title, track.artist, track.album, track.genre]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return source.includes(query);
}

function matchesMood(track) {
  if (currentMood === "all") {
    return true;
  }

  const label = String(track.genre || track.mood || "").toLowerCase();
  return !label || label.includes(currentMood);
}

function getFilteredTracks() {
  const query = searchInput.value.trim().toLowerCase();
  return tracks.filter((track) => matchesMood(track) && matchesQuery(track, query));
}

function renderQuickPicks() {
  quickGrid.innerHTML = tracks
    .slice(0, 4)
    .map(
      (track) => `
        <button class="quick-card" type="button" data-track-id="${escapeHtml(track.id)}">
          <span class="mini-cover cover-gradient-2"${artworkStyle(track)}></span>
          <span>${escapeHtml(track.title)}</span>
        </button>
      `
    )
    .join("");
}

function renderAlbums() {
  const visibleTracks = getFilteredTracks();

  if (visibleTracks.length === 0) {
    albumGrid.innerHTML = '<p class="catalog-state">No tracks match the selected filter.</p>';
    return;
  }

  albumGrid.innerHTML = visibleTracks
    .map(
      (track) => `
        <article class="album-card" tabindex="0">
          <div class="album-cover cover-gradient-2"${artworkStyle(track)}></div>
          <button class="card-play" type="button" aria-label="Play ${escapeHtml(track.title)}" data-track-id="${escapeHtml(track.id)}">
            ${icon("play")}
          </button>
          <div>
            <strong class="album-title">${escapeHtml(track.title)}</strong>
            <span class="album-meta">${escapeHtml(track.artist)}${track.album ? ` - ${escapeHtml(track.album)}` : ""}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderTracks() {
  const visibleTracks = getFilteredTracks();
  const rows = visibleTracks
    .map((track, visibleIndex) => {
      const isCurrent = track.id === currentTrackId;
      return `
        <button class="track-row ${isCurrent ? "playing" : ""}" type="button" data-track-id="${escapeHtml(track.id)}">
          <span>${visibleIndex + 1}</span>
          <span class="track-title-cell">
            <span class="mini-cover cover-gradient-2"${artworkStyle(track)}></span>
            <span>
              <span class="track-name">${escapeHtml(track.title)}</span>
              <span class="track-artist">${escapeHtml(track.artist)}</span>
            </span>
          </span>
          <span class="track-album">${escapeHtml(track.album || "Single")}</span>
          <span class="track-duration">${formatTime(track.duration ?? track.durationSeconds)}</span>
        </button>
      `;
    })
    .join("");

  trackTable.innerHTML = `
    <div class="track-row table-head" aria-hidden="true">
      <span>#</span>
      <span>Title</span>
      <span>Album</span>
      <span class="time-head">${icon("clock")}</span>
    </div>
    ${rows || '<p class="catalog-state">No tracks match the selected filter.</p>'}
  `;
}

function renderAll() {
  renderQuickPicks();
  renderAlbums();
  renderTracks();
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    currentMood = button.dataset.filter;
    renderAll();
  });
});

searchInput.addEventListener("input", renderAll);

document.addEventListener("click", (event) => {
  const trackButton = event.target.closest("[data-track-id]");

  if (trackButton) {
    setCurrentTrack(trackButton.dataset.trackId, true);
  }
});

playerPlay.addEventListener("click", togglePlay);
heroPlay.addEventListener("click", togglePlay);

likeButton.addEventListener("click", () => {
  likeButton.classList.toggle("active");
});

progressInput.addEventListener("input", () => {
  const track = getCurrentTrack();

  if (!track) {
    return;
  }

  const duration = Number(track.duration ?? track.durationSeconds) || 0;
  progressSeconds = Math.round((Number(progressInput.value) / 100) * duration);
  elapsedTime.textContent = formatTime(progressSeconds);
});

if (document.body.classList.contains("authenticated")) {
  loadTracks();
} else {
  window.addEventListener("music:authenticated", loadTracks, { once: true });
}
