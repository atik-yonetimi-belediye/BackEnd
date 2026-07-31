const express = require("express");
const mahalleController = require("./mahalle.controller");
const {
  validateParams,
  validateQuery,
} = require("../../middlewares/validateMiddleware");
const schemas = require("../../middlewares/validationSchemas").mahalle;

const router = express.Router();

router.get("/", validateQuery(schemas.listQuery), mahalleController.getAllMahalleler);
router.get("/:id", validateParams(schemas.idParams), mahalleController.getMahalleById);

module.exports = router;
