const express = require("express");

const adminController = require("./admin.controller");
const authMiddleware = require("../../middlewares/authMiddleware");
const roleMiddleware = require("../../middlewares/roleMiddleware");
const {
  validateBody,
  validateParams,
  validateQuery,
} = require("../../middlewares/validateMiddleware");
const schemas = require("../../middlewares/validationSchemas").admin;

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware("admin"));

router.get("/dashboard", adminController.getDashboard);

router.get("/cavuslar", validateQuery(schemas.listQuery), adminController.getAllCavuslar);
router.get("/soforler", validateQuery(schemas.listQuery), adminController.getAllSoforler);

router.get("/sirketler", validateQuery(schemas.sirketListQuery), adminController.getAllSirketler);
router.patch("/sirketler/:id/onay-durumu", validateParams(schemas.idParams), validateBody(schemas.updateSirketOnay), adminController.updateSirketOnayDurumu);

router.get("/konteynerler", validateQuery(schemas.konteynerListQuery), adminController.getAllKonteynerler);
router.get("/araclar", validateQuery(schemas.aracListQuery), adminController.getAllAraclar);
router.get("/toplama-kayitlari", validateQuery(schemas.toplamaListQuery), adminController.getAllToplamaKayitlari);

module.exports = router;
