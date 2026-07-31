const express = require("express");

const soforController = require("./sofor.controller");
const authMiddleware = require("../../middlewares/authMiddleware");
const roleMiddleware = require("../../middlewares/roleMiddleware");
const {
  validateBody,
  validateQuery,
} = require("../../middlewares/validateMiddleware");
const schemas = require("../../middlewares/validationSchemas").sofor;

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware("sofor"));

router.get("/me", soforController.getMe);
router.get("/konteynerler", validateQuery(schemas.listQuery), soforController.getAvailableKonteynerlerForSofor);
router.post("/toplama-kayitlari", validateBody(schemas.createToplamaKaydi), soforController.createToplamaKaydi);
router.get("/toplama-kayitlari", validateQuery(schemas.listQuery), soforController.getMyToplamaKayitlari);

module.exports = router;
