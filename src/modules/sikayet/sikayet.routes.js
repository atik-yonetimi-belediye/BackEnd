const express = require("express");

const sikayetController = require("./sikayet.controller");
const authMiddleware = require("../../middlewares/authMiddleware");
const roleMiddleware = require("../../middlewares/roleMiddleware");
const { uploadSikayetFotograflari } = require("../../middlewares/uploadMiddleware");
const {
  validateUploadedImageSignatures,
} = require("../../utils/uploadFiles");
const {
  validateBody,
  validateParams,
  validateQuery,
} = require("../../middlewares/validateMiddleware");
const schemas = require("../../middlewares/validationSchemas").sikayet;

const router = express.Router();

router.post(
  "/",
  uploadSikayetFotograflari.array("fotograflar", 3),
  validateUploadedImageSignatures,
  validateBody(schemas.create),
  sikayetController.createSikayet
);

router.get(
  "/",
  authMiddleware,
  roleMiddleware("admin"),
  validateQuery(schemas.listQuery),
  sikayetController.getAllSikayetler
);

router.get(
  "/:id",
  authMiddleware,
  roleMiddleware("admin"),
  validateParams(schemas.idParams),
  sikayetController.getSikayetById
);

router.patch(
  "/:id/durum",
  authMiddleware,
  roleMiddleware("admin"),
  validateParams(schemas.idParams),
  validateBody(schemas.updateDurum),
  sikayetController.updateSikayetDurumu
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("admin"),
  validateParams(schemas.idParams),
  sikayetController.deleteSikayet
);

module.exports = router;
