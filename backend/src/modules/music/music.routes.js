const express = require("express");
const multer = require("multer");
const controller = require("./music.controller");
const { requireAdminKey } = require("../../middlewares/admin.middleware");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024,
  },
});

router.get("/tracks", controller.listTracks);
router.get("/tracks/:id", controller.getTrack);
router.post("/tracks", requireAdminKey, controller.createTrack);
router.post(
  "/tracks/upload",
  requireAdminKey,
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "cover", maxCount: 1 },
  ]),
  controller.uploadTrack
);
router.put("/tracks/:id", requireAdminKey, controller.updateTrack);
router.patch("/tracks/:id", requireAdminKey, controller.updateTrack);
router.delete("/tracks/:id", requireAdminKey, controller.deleteTrack);
router.post("/tracks/:id/play", controller.registerPlay);

module.exports = router;
