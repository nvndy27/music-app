const express = require("express");
const controller = require("./playback.controller");

const router = express.Router();

router.get("/state", controller.getState);
router.post("/play", controller.play);
router.post("/pause", controller.pause);
router.post("/seek", controller.seek);
router.post("/volume", controller.setVolume);
router.post("/queue", controller.setQueue);
router.post("/next", controller.next);
router.post("/previous", controller.previous);

module.exports = router;
