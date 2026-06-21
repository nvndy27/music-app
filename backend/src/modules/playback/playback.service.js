const musicService = require("../music/music.service");
const { ApiError } = require("../../shared/http");

const playback = {
  userId: null,
  currentTrackId: null,
  isPlaying: false,
  positionSeconds: 0,
  volume: 72,
  queue: [],
  updatedAt: new Date().toISOString(),
};

function touch() {
  playback.updatedAt = new Date().toISOString();
}

async function getState() {
  const currentTrack = playback.currentTrackId
    ? await musicService.getTrack(playback.currentTrackId)
    : null;

  const queue = await Promise.all(
    playback.queue.map(async (trackId) => {
      try {
        return await musicService.getTrack(trackId);
      } catch (error) {
        return null;
      }
    })
  );

  return {
    ...playback,
    currentTrack,
    queue: queue.filter(Boolean),
  };
}

async function play(payload = {}, actor = null) {
  const trackId = payload.trackId || playback.currentTrackId;

  if (!trackId) {
    throw new ApiError(400, "trackId is required to start playback");
  }

  const track = await musicService.getTrack(trackId);
  await musicService.increasePlayCount(trackId);

  playback.userId = actor?.id || playback.userId;
  playback.currentTrackId = track.id;
  playback.isPlaying = true;
  playback.positionSeconds = Number(payload.positionSeconds || 0);
  touch();

  if (!playback.queue.includes(track.id)) {
    playback.queue.unshift(track.id);
  }

  return getState();
}

async function pause() {
  playback.isPlaying = false;
  touch();
  return getState();
}

async function seek(payload) {
  const seconds = Number(payload.positionSeconds);

  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new ApiError(400, "positionSeconds must be a positive number");
  }

  playback.positionSeconds = seconds;
  touch();
  return getState();
}

async function setVolume(payload) {
  const volume = Number(payload.volume);

  if (!Number.isFinite(volume) || volume < 0 || volume > 100) {
    throw new ApiError(400, "volume must be between 0 and 100");
  }

  playback.volume = volume;
  touch();
  return getState();
}

async function setQueue(payload) {
  const queue = Array.isArray(payload.trackIds) ? payload.trackIds : [];

  for (const trackId of queue) {
    await musicService.getTrack(trackId);
  }

  playback.queue = queue;

  if (!playback.currentTrackId && queue.length > 0) {
    playback.currentTrackId = queue[0];
  }

  touch();
  return getState();
}

async function next() {
  if (playback.queue.length === 0) {
    throw new ApiError(400, "Playback queue is empty");
  }

  const currentIndex = playback.queue.indexOf(playback.currentTrackId);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % playback.queue.length : 0;
  playback.currentTrackId = playback.queue[nextIndex];
  playback.positionSeconds = 0;
  playback.isPlaying = true;
  touch();
  await musicService.increasePlayCount(playback.currentTrackId);
  return getState();
}

async function previous() {
  if (playback.queue.length === 0) {
    throw new ApiError(400, "Playback queue is empty");
  }

  const currentIndex = playback.queue.indexOf(playback.currentTrackId);
  const previousIndex =
    currentIndex > 0 ? currentIndex - 1 : playback.queue.length - 1;

  playback.currentTrackId = playback.queue[previousIndex];
  playback.positionSeconds = 0;
  playback.isPlaying = true;
  touch();
  await musicService.increasePlayCount(playback.currentTrackId);
  return getState();
}

module.exports = {
  getState,
  play,
  pause,
  seek,
  setVolume,
  setQueue,
  next,
  previous,
};
