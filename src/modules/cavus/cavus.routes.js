const express = require("express");

const cavusController = require("./cavus.controller");
const authMiddleware = require("../../middlewares/authMiddleware");
const roleMiddleware = require("../../middlewares/roleMiddleware");
const {
  validateBody,
  validateParams,
  validateQuery,
} = require("../../middlewares/validateMiddleware");
const schemas = require("../../middlewares/validationSchemas").cavus;

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware("cavus"));

router.get("/me", cavusController.getMe);

router.get("/konteynerler", validateQuery(schemas.listQuery), cavusController.getMyKonteynerler);
router.post("/konteynerler", validateBody(schemas.createKonteyner), cavusController.createKonteyner);
router.patch("/konteynerler/:id/passive", validateParams(schemas.idParams), cavusController.passiveKonteyner);

router.get("/araclar", validateQuery(schemas.listQuery), cavusController.getMyAraclar);
router.post("/araclar", validateBody(schemas.createArac), cavusController.createArac);
router.patch("/araclar/:id", validateParams(schemas.idParams), validateBody(schemas.updateArac), cavusController.updateArac);
router.patch("/araclar/:id/passive", validateParams(schemas.idParams), cavusController.passiveArac);

router.get("/soforler", validateQuery(schemas.listQuery), cavusController.getMySoforler);
router.post("/soforler", validateBody(schemas.createSofor), cavusController.createSofor);
router.patch("/soforler/:id/arac", validateParams(schemas.idParams), validateBody(schemas.updateSoforArac), cavusController.updateSoforArac);
router.patch("/soforler/:id/passive", validateParams(schemas.idParams), cavusController.passiveSofor);

router.get("/toplama-kayitlari", validateQuery(schemas.listQuery), cavusController.getMyToplamaKayitlari);

module.exports = router;
