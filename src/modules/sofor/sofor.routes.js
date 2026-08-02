const express = require("express");

const soforController = require("./sofor.controller");
const authMiddleware = require("../../middlewares/authMiddleware");
const roleMiddleware = require("../../middlewares/roleMiddleware");
const {
  validateBody,
  validateQuery,
  validateParams,
} = require("../../middlewares/validateMiddleware");
const schemas = require("../../middlewares/validationSchemas").sofor;
const requirePermission = require("../../middlewares/requirePermission");
const { uploadToplamaKaniti } = require("../../middlewares/uploadMiddleware");
const { validateUploadedImageSignatures } = require("../../utils/uploadFiles");

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware("sofor"));

router.get("/me", soforController.getMe);
router.get("/konteynerler", requirePermission("task.view"), validateQuery(schemas.listQuery), soforController.getAvailableKonteynerlerForSofor);
router.post(
  "/toplama-kayitlari",
  uploadToplamaKaniti.single("kanit_fotografi"),
  validateUploadedImageSignatures,
  requirePermission.dynamic((req) => req.body.durum === "atlanildi" ? "collection.skip" : "collection.complete"),
  requirePermission.dynamic((req) => req.file ? "collection.attach_evidence" : (req.body.durum === "atlanildi" ? "collection.skip" : "collection.complete")),
  requirePermission.dynamic((req) => (req.body.latitude || req.body.longitude) ? "location.share" : (req.body.durum === "atlanildi" ? "collection.skip" : "collection.complete")),
  validateBody(schemas.createToplamaKaydi),
  soforController.createToplamaKaydi
);
router.get("/toplama-kayitlari", requirePermission("own_history.view"), validateQuery(schemas.listQuery), soforController.getMyToplamaKayitlari);
router.get("/gorevler", requirePermission("task.view"), validateQuery(schemas.gorevListQuery), soforController.getMyTasks);
router.patch("/gorevler/:id/baslat", requirePermission("task.start"), validateParams(schemas.gorevIdParams), soforController.startTask);

module.exports = router;
