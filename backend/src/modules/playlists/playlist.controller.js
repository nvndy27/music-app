const playlistService = require("./playlist.service");
const { asyncHandler, sendCreated, sendOk } = require("../../shared/http");

const listPlaylists = asyncHandler(async (req, res) => {
  const playlists = await playlistService.listPlaylists();
  sendOk(res, playlists);
});

const getPlaylist = asyncHandler(async (req, res) => {
  const playlist = await playlistService.getPlaylist(req.params.id);
  sendOk(res, playlist);
});

const createPlaylist = asyncHandler(async (req, res) => {
  const playlist = await playlistService.createPlaylist(req.body, req.user);
  sendCreated(res, playlist);
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const playlist = await playlistService.updatePlaylist(req.params.id, req.body, req.user);
  sendOk(res, playlist);
});

const addTrack = asyncHandler(async (req, res) => {
  const playlist = await playlistService.addTrack(req.params.id, req.body.trackId, req.user);
  sendOk(res, playlist);
});

const removeTrack = asyncHandler(async (req, res) => {
  const playlist = await playlistService.removeTrack(
    req.params.id,
    req.params.trackId,
    req.user
  );
  sendOk(res, playlist);
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const result = await playlistService.deletePlaylist(req.params.id, req.user);
  sendOk(res, result);
});

module.exports = {
  listPlaylists,
  getPlaylist,
  createPlaylist,
  updatePlaylist,
  addTrack,
  removeTrack,
  deletePlaylist,
};
