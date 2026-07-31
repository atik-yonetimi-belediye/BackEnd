const mahalleService = require("./mahalle.service");
const { successResponse, errorResponse } = require("../../utils/response");

async function getAllMahalleler(req, res) {
  try {
    const data = await mahalleService.getAllMahalleler(req.query);
    return successResponse(res, "Mahalleler başarıyla listelendi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function getMahalleById(req, res) {
  try {
    const { id } = req.params;
    const mahalle = await mahalleService.getMahalleById(id);

    if (!mahalle) {
      return errorResponse(res, "Mahalle bulunamadı.", 404);
    }

    return successResponse(res, "Mahalle başarıyla getirildi.", mahalle);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

module.exports = {
  getAllMahalleler,
  getMahalleById,
};
