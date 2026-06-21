const playbackService = require("./playback.service");
const { asyncHandler, sendOk } = require("../../shared/http");

const getState = asyncHandler(async (req, res) => {
  const state = await playbackService.getState();
  sendOk(res, state);
});

const play = asyncHandler(async (req, res) => {
  const state = await playbackService.play(req.body, req.user);
  sendOk(res, state);
});

const pause = asyncHandler(async (req, res) => {
  const state = await playbackService.pause();
  sendOk(res, state);
});

const seek = asyncHandler(async (req, res) => {
  const state = await playbackService.seek(req.body);
  sendOk(res, state);
});

const setVolume = asyncHandler(async (req, res) => {
  const state = await playbackService.setVolume(req.body);
  sendOk(res, state);
});

const setQueue = asyncHandler(async (req, res) => {
  const state = await playbackService.setQueue(req.body);
  sendOk(res, state);
});

const next = asyncHandler(async (req, res) => {
  const state = await playbackService.next();
  sendOk(res, state);
});

const previous = asyncHandler(async (req, res) => {
  const state = await playbackService.previous();
  sendOk(res, state);
});

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
