const express = require("express");

const recyclingController = require("./recycling.controller");
const authMiddleware = require("../../middlewares/authMiddleware");
const roleMiddleware = require("../../middlewares/roleMiddleware");
const {
  validateBody,
  validateParams,
  validateQuery,
} = require("../../middlewares/validateMiddleware");
const schemas = require("../../middlewares/validationSchemas").recycling;

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware("admin"));

router.get("/", validateQuery(schemas.listQuery), recyclingController.getAllGeriDonusumTalepleri);
router.get("/:id", validateParams(schemas.idParams), recyclingController.getGeriDonusumTalebiById);
router.patch("/:id/durum", validateParams(schemas.idParams), validateBody(schemas.updateDurum), recyclingController.updateGeriDonusumTalebiDurumu);

module.exports = router;
