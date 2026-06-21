const express = require("express");
const controller = require("./user.controller");
const { requireAuth } = require("../../middlewares/auth.middleware");

const router = express.Router();

router.use(requireAuth);
router.get("/", controller.listUsers);
router.get("/:id", controller.getUser);
router.get("/:id/liked-tracks", controller.listLikedTracks);
router.post("/:id/liked-tracks/:trackId", controller.likeTrack);
router.delete("/:id/liked-tracks/:trackId", controller.unlikeTrack);
router.patch("/:id", controller.updateUser);
router.delete("/:id", controller.deleteUser);

module.exports = router;
