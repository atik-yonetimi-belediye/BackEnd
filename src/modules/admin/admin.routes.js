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
const containerTaskController = require("./containerTask.controller");
const containerManagementController = require("./containerManagement.controller");
const permissionController = require("./permission.controller");

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware("admin"));

router.get("/dashboard", adminController.getDashboard);

router.get("/cavuslar", validateQuery(schemas.cavusListQuery), adminController.getAllCavuslar);
router.post("/cavuslar", validateBody(schemas.createCavus), adminController.createCavus);
router.patch("/cavuslar/:id", validateParams(schemas.idParams), validateBody(schemas.updateCavus), adminController.updateCavus);
router.patch("/cavuslar/:id/durum", validateParams(schemas.idParams), validateBody(schemas.updatePersonelDurum), adminController.updateCavusDurum);
router.patch("/cavuslar/:id/sifre", validateParams(schemas.idParams), validateBody(schemas.resetPersonelPassword), adminController.resetCavusPassword);
router.delete("/cavuslar/:id", validateParams(schemas.idParams), adminController.deleteCavus);

router.get("/soforler", validateQuery(schemas.soforListQuery), adminController.getAllSoforler);
router.post("/soforler", validateBody(schemas.createSofor), adminController.createSofor);
router.patch("/soforler/:id", validateParams(schemas.idParams), validateBody(schemas.updateSofor), adminController.updateSofor);
router.patch("/soforler/:id/durum", validateParams(schemas.idParams), validateBody(schemas.updatePersonelDurum), adminController.updateSoforDurum);
router.patch("/soforler/:id/sifre", validateParams(schemas.idParams), validateBody(schemas.resetPersonelPassword), adminController.resetSoforPassword);
router.delete("/soforler/:id", validateParams(schemas.idParams), adminController.deleteSofor);

router.get("/personel/:accountType/:id/yetkiler", validateParams(schemas.personelYetkiParams), permissionController.getPermissions);
router.put("/personel/:accountType/:id/yetkiler", validateParams(schemas.personelYetkiParams), validateBody(schemas.updatePersonelYetkileri), permissionController.updatePermissions);
router.delete("/personel/:accountType/:id/yetkiler", validateParams(schemas.personelYetkiParams), permissionController.resetPermissions);
router.get("/personel/:accountType/:id/islem-gecmisi", validateParams(schemas.personelYetkiParams), permissionController.getPersonTimeline);

router.get("/sirketler", validateQuery(schemas.sirketListQuery), adminController.getAllSirketler);
router.patch("/sirketler/:id/onay-durumu", validateParams(schemas.idParams), validateBody(schemas.updateSirketOnay), adminController.updateSirketOnayDurumu);

router.get("/konteynerler", validateQuery(schemas.konteynerListQuery), adminController.getAllKonteynerler);
router.post("/konteynerler", validateBody(schemas.createKonteyner), containerManagementController.createContainer);
router.post("/konteynerler/toplu-gorevler", validateBody(schemas.bulkKonteynerGorevi), containerTaskController.createBulkContainerTasks);
router.get("/konteynerler/:id/detay", validateParams(schemas.idParams), containerManagementController.getContainerDetail);
router.get("/konteynerler/:id/qr", validateParams(schemas.idParams), validateQuery(schemas.konteynerQrQuery), containerManagementController.createContainerQr);
router.patch("/konteynerler/:id", validateParams(schemas.idParams), validateBody(schemas.updateKonteyner), containerManagementController.updateContainer);
router.patch("/konteynerler/:id/durum", validateParams(schemas.idParams), validateBody(schemas.updateKonteynerDurum), containerManagementController.updateContainerStatus);
router.delete("/konteynerler/:id", validateParams(schemas.idParams), containerManagementController.deleteContainer);
router.get("/konteynerler/:id/gorevler", validateParams(schemas.idParams), validateQuery(schemas.gorevListQuery), containerTaskController.getContainerTasks);
router.get("/konteynerler/:id/uygun-soforler", validateParams(schemas.idParams), containerTaskController.getEligibleDrivers);
router.post("/konteynerler/:id/gorevler", validateParams(schemas.idParams), validateBody(schemas.createKonteynerGorevi), containerTaskController.createContainerTask);
router.patch("/konteynerler/:id/cavus", validateParams(schemas.idParams), validateBody(schemas.updateKonteynerCavus), containerTaskController.updateContainerCavus);
router.patch("/konteyner-gorevleri/:id", validateParams(schemas.idParams), validateBody(schemas.updateKonteynerGorevi), containerTaskController.updateTask);
router.patch("/konteyner-gorevleri/:id/iptal", validateParams(schemas.idParams), validateBody(schemas.cancelKonteynerGorevi), containerTaskController.cancelTask);
router.get("/araclar", validateQuery(schemas.aracListQuery), adminController.getAllAraclar);
router.post("/araclar", validateBody(schemas.createArac), adminController.createArac);
router.patch("/araclar/:id", validateParams(schemas.idParams), validateBody(schemas.updateArac), adminController.updateArac);
router.patch("/araclar/:id/durum", validateParams(schemas.idParams), validateBody(schemas.updateAracDurum), adminController.updateAracDurum);
router.patch("/araclar/:id/atama", validateParams(schemas.idParams), validateBody(schemas.updateAracAtama), adminController.updateAracAtama);
router.delete("/araclar/:id", validateParams(schemas.idParams), adminController.deleteArac);
router.get("/toplama-kayitlari", validateQuery(schemas.toplamaListQuery), adminController.getAllToplamaKayitlari);

module.exports = router;
