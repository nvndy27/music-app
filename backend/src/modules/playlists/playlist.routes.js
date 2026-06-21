const express = require("express");
const controller = require("./playlist.controller");
const { requireAuth } = require("../../middlewares/auth.middleware");

const router = express.Router();

router.get("/", controller.listPlaylists);
router.get("/:id", controller.getPlaylist);
router.post("/", requireAuth, controller.createPlaylist);
router.put("/:id", requireAuth, controller.updatePlaylist);
router.patch("/:id", requireAuth, controller.updatePlaylist);
router.post("/:id/tracks", requireAuth, controller.addTrack);
router.delete("/:id/tracks/:trackId", requireAuth, controller.removeTrack);
router.delete("/:id", requireAuth, controller.deletePlaylist);

module.exports = router;
