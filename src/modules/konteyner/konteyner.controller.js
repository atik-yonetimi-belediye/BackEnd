const konteynerService = require("./konteyner.service");
const { successResponse, errorResponse } = require("../../utils/response");

async function getAllKonteynerler(req, res) {
  try {
    const data = await konteynerService.getAllKonteynerler(req.query);

    return successResponse(res, "Konteynerler başarıyla listelendi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function getKonteynerById(req, res) {
  try {
    const { id } = req.params;

    const konteyner = await konteynerService.getKonteynerById(id);

    if (!konteyner) {
      return errorResponse(res, "Konteyner bulunamadı.", 404);
    }

    return successResponse(res, "Konteyner başarıyla getirildi.", konteyner);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

module.exports = {
  getAllKonteynerler,
  getKonteynerById,
};
