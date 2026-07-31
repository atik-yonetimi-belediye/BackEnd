const express = require("express");
const authController = require("./auth.controller");
const { validateBody } = require("../../middlewares/validateMiddleware");
const schemas = require("../../middlewares/validationSchemas").auth;
const authMiddleware = require("../../middlewares/authMiddleware");

const router = express.Router();

router.post("/login", validateBody(schemas.login), authController.login);
router.post(
  "/sirket/register",
  validateBody(schemas.sirketRegister),
  authController.registerSirket
);
router.get("/session", authMiddleware, authController.getSession);
router.post("/logout", authMiddleware, authController.logout);

module.exports = router;
