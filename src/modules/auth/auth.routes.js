const express = require("express");
const authController = require("./auth.controller");
const { validateBody } = require("../../middlewares/validateMiddleware");
const schemas = require("../../middlewares/validationSchemas").auth;
const authMiddleware = require("../../middlewares/authMiddleware");

const router = express.Router();

router.post("/admin/login", validateBody(schemas.adminLogin), authController.loginAdmin);
router.post("/cavus/login", validateBody(schemas.phoneLogin), authController.loginCavus);
router.post("/sofor/login", validateBody(schemas.phoneLogin), authController.loginSofor);
router.post("/sirket/login", validateBody(schemas.sirketLogin), authController.loginSirket);
router.post(
  "/sirket/register",
  validateBody(schemas.sirketRegister),
  authController.registerSirket
);
router.get("/session", authMiddleware, authController.getSession);
router.post("/logout", authMiddleware, authController.logout);

module.exports = router;
