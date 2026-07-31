const express = require("express");

const sirketController = require("./sirket.controller");
const authMiddleware = require("../../middlewares/authMiddleware");
const roleMiddleware = require("../../middlewares/roleMiddleware");
const {
  validateBody,
  validateParams,
  validateQuery,
} = require("../../middlewares/validateMiddleware");
const schemas = require("../../middlewares/validationSchemas").sirket;

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware("sirket"));

router.get("/me", sirketController.getMe);

router.post(
  "/geri-donusum-talepleri",
  validateBody(schemas.createTalep),
  sirketController.createGeriDonusumTalebi
);

router.get(
  "/geri-donusum-talepleri",
  validateQuery(schemas.listQuery),
  sirketController.getMyGeriDonusumTalepleri
);

router.put(
  "/geri-donusum-talepleri/:id",
  validateParams(schemas.idParams),
  validateBody(schemas.updateTalep),
  sirketController.updateGeriDonusumTalebi
);

router.patch(
  "/geri-donusum-talepleri/:id/cancel",
  validateParams(schemas.idParams),
  sirketController.cancelGeriDonusumTalebi
);

module.exports = router;
