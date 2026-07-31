const publicService = require("./public.service");
const { successResponse, errorResponse } = require("../../utils/response");

async function getPublicStats(req, res) {
  try {
    const data = await publicService.getPublicStats();
    return successResponse(res, "Güncel sistem istatistikleri getirildi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

module.exports = {
  getPublicStats,
};
