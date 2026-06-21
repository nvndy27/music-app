const musicService = require("./music.service");
const { asyncHandler, sendCreated, sendOk } = require("../../shared/http");

const listTracks = asyncHandler(async (req, res) => {
  const tracks = await musicService.listTracks(req.query);
  sendOk(res, tracks);
});

const getTrack = asyncHandler(async (req, res) => {
  const track = await musicService.getTrack(req.params.id);
  sendOk(res, track);
});

const createTrack = asyncHandler(async (req, res) => {
  const track = await musicService.createTrack(req.body);
  sendCreated(res, track);
});

const uploadTrack = asyncHandler(async (req, res) => {
  const track = await musicService.uploadTrack(req.body, req.files);
  sendCreated(res, track);
});

const updateTrack = asyncHandler(async (req, res) => {
  const track = await musicService.updateTrack(req.params.id, req.body);
  sendOk(res, track);
});

const deleteTrack = asyncHandler(async (req, res) => {
  const result = await musicService.deleteTrack(req.params.id);
  sendOk(res, result);
});

const registerPlay = asyncHandler(async (req, res) => {
  const track = await musicService.increasePlayCount(req.params.id);
  sendOk(res, track);
});

module.exports = {
  listTracks,
  getTrack,
  createTrack,
  uploadTrack,
  updateTrack,
  deleteTrack,
  registerPlay,
};
