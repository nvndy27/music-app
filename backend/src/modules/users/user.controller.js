const userService = require("./user.service");
const { ApiError, asyncHandler, sendOk } = require("../../shared/http");

const listUsers = asyncHandler(async (req, res) => {
  const users = await userService.listUsers();
  sendOk(res, users);
});

const getUser = asyncHandler(async (req, res) => {
  const user = await userService.findById(req.params.id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  sendOk(res, user);
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body, req.user);
  sendOk(res, user);
});

const deleteUser = asyncHandler(async (req, res) => {
  const result = await userService.deleteUser(req.params.id, req.user);
  sendOk(res, result);
});

const listLikedTracks = asyncHandler(async (req, res) => {
  const tracks = await userService.listLikedTracks(req.params.id);
  sendOk(res, tracks);
});

const likeTrack = asyncHandler(async (req, res) => {
  const track = await userService.likeTrack(req.params.id, req.params.trackId, req.user);
  sendOk(res, track);
});

const unlikeTrack = asyncHandler(async (req, res) => {
  const result = await userService.unlikeTrack(req.params.id, req.params.trackId, req.user);
  sendOk(res, result);
});

module.exports = {
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  listLikedTracks,
  likeTrack,
  unlikeTrack,
};
