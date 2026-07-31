const express = require("express");
const konteynerController = require("./konteyner.controller");
const {
  validateParams,
  validateQuery,
} = require("../../middlewares/validateMiddleware");
const schemas = require("../../middlewares/validationSchemas").konteyner;

const router = express.Router();

router.get("/", validateQuery(schemas.listQuery), konteynerController.getAllKonteynerler);
router.get("/:id", validateParams(schemas.idParams), konteynerController.getKonteynerById);

module.exports = router;
