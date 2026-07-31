const express = require("express");
const publicController = require("./public.controller");

const router = express.Router();

router.get("/stats", publicController.getPublicStats);

module.exports = router;
