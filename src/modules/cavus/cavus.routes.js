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
const requirePermission = require("../../middlewares/requirePermission");

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware("cavus"));

router.get("/me", cavusController.getMe);

router.get("/konteynerler", requirePermission("container.view"), validateQuery(schemas.listQuery), cavusController.getMyKonteynerler);
router.post("/konteynerler/toplu-gorevler", requirePermission("task.assign"), validateBody(schemas.bulkKonteynerGorevi), cavusController.createBulkContainerTasks);
router.post("/konteynerler", requirePermission("container.create"), validateBody(schemas.createKonteyner), cavusController.createKonteyner);
router.get("/konteynerler/:id/uygun-soforler", requirePermission("task.assign"), validateParams(schemas.idParams), cavusController.getEligibleDrivers);
router.post("/konteynerler/:id/gorevler", requirePermission("task.assign"), validateParams(schemas.idParams), validateBody(schemas.createKonteynerGorevi), cavusController.createContainerTask);
router.patch("/konteynerler/:id", requirePermission("container.edit"), validateParams(schemas.idParams), validateBody(schemas.updateKonteyner), cavusController.updateKonteyner);
router.patch("/gorevler/:id/iptal", requirePermission("task.cancel"), validateParams(schemas.idParams), validateBody(schemas.cancelKonteynerGorevi), cavusController.cancelContainerTask);
router.patch("/konteynerler/:id/passive", requirePermission("container.deactivate"), validateParams(schemas.idParams), cavusController.passiveKonteyner);

router.get("/araclar", requirePermission("vehicle.view"), validateQuery(schemas.listQuery), cavusController.getMyAraclar);
router.post("/araclar", requirePermission("vehicle.create"), validateBody(schemas.createArac), cavusController.createArac);
router.patch("/araclar/:id", requirePermission("vehicle.edit"), validateParams(schemas.idParams), validateBody(schemas.updateArac), cavusController.updateArac);
router.patch("/araclar/:id/passive", requirePermission("vehicle.deactivate"), validateParams(schemas.idParams), cavusController.passiveArac);

router.get("/soforler", requirePermission("driver.view"), validateQuery(schemas.listQuery), cavusController.getMySoforler);
router.post("/soforler", requirePermission("driver.create"), validateBody(schemas.createSofor), cavusController.createSofor);
router.patch("/soforler/:id", requirePermission("driver.edit"), validateParams(schemas.idParams), validateBody(schemas.updateSofor), cavusController.updateSofor);
router.patch("/soforler/:id/arac", requirePermission("driver.assign_vehicle"), validateParams(schemas.idParams), validateBody(schemas.updateSoforArac), cavusController.updateSoforArac);
router.patch("/soforler/:id/passive", requirePermission("driver.deactivate"), validateParams(schemas.idParams), cavusController.passiveSofor);

router.get("/toplama-kayitlari", requirePermission("collection.history.view"), validateQuery(schemas.listQuery), cavusController.getMyToplamaKayitlari);

module.exports = router;
