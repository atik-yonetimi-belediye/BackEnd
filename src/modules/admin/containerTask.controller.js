const service = require("./containerTask.service");
const { successResponse, errorResponse } = require("../../utils/response");

const handle = (work) => async (req, res) => {
  try { return await work(req, res); }
  catch (error) { return errorResponse(res, error.message, error.statusCode || 500, error.errors); }
};

const getContainerTasks = handle(async (req, res) => successResponse(res, "Konteyner görevleri listelendi.", await service.getContainerTasks(req.params.id, req.query)));
const getEligibleDrivers = handle(async (req, res) => successResponse(res, "Uygun şoförler listelendi.", await service.getEligibleDrivers(req.params.id, req.user.role === "cavus" ? req.user.id : null)));
const actor = (req) => ({ role: req.user.role, id: req.user.id, name: req.user.ad_soyad || req.user.ad || "Yönetici" });
const createContainerTask = handle(async (req, res) => successResponse(res, "Konteyner görevi oluşturuldu.", await service.createContainerTask(actor(req), req.params.id, req.body), 201));
const createBulkContainerTasks = handle(async (req, res) => successResponse(res, "Konteyner görevleri toplu oluşturuldu.", await service.createBulkContainerTasks(actor(req), req.body.konteyner_ids, req.body), 201));
const updateContainerCavus = handle(async (req, res) => successResponse(res, "Konteyner sorumlusu güncellendi.", await service.updateContainerCavus(req.params.id, req.body, actor(req))));
const updateTask = handle(async (req, res) => successResponse(res, "Görev güncellendi.", await service.updateTask(req.params.id, req.body, actor(req))));
const cancelTask = handle(async (req, res) => successResponse(res, "Görev iptal edildi.", await service.cancelTask(req.params.id, req.body.iptal_nedeni, actor(req))));

module.exports = { getContainerTasks, getEligibleDrivers, createContainerTask, createBulkContainerTasks, updateContainerCavus, updateTask, cancelTask };
