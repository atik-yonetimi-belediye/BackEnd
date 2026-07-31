const sirketService = require("./sirket.service");
const { successResponse, errorResponse } = require("../../utils/response");

async function getMe(req, res) {
  try {
    const data = await sirketService.getMe(req.user.id);

    if (!data) {
      return errorResponse(res, "Şirket bilgisi bulunamadı.", 404);
    }

    return successResponse(res, "Şirket bilgisi getirildi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function createGeriDonusumTalebi(req, res) {
  try {
    const {
      konteyner_id,
      talep_basligi,
      talep_aciklamasi,
      tahmini_miktar,
      adres,
    } = req.body;

    if (!talep_basligi && !talep_aciklamasi) {
      return errorResponse(
        res,
        "Talep başlığı veya talep açıklaması alanlarından en az biri girilmelidir.",
        400
      );
    }

    const data = await sirketService.createGeriDonusumTalebi(req.user.id, {
      konteyner_id,
      talep_basligi,
      talep_aciklamasi,
      tahmini_miktar,
      adres,
    });

    return successResponse(res, "Geri dönüşüm talebi oluşturuldu.", data, 201);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function getMyGeriDonusumTalepleri(req, res) {
  try {
    const data = await sirketService.getMyGeriDonusumTalepleri(
      req.user.id,
      req.query
    );

    return successResponse(
      res,
      "Şirkete ait geri dönüşüm talepleri listelendi.",
      data
    );
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function updateGeriDonusumTalebi(req, res) {
  try {
    const { id } = req.params;
    const data = await sirketService.updateGeriDonusumTalebi(req.user.id, id, req.body);
    if (!data) return errorResponse(res, "Talep bulunamadı veya düzenlenemez durumda.", 400);
    return successResponse(res, "Talep başarıyla güncellendi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function cancelGeriDonusumTalebi(req, res) {
  try {
    const { id } = req.params;
    const data = await sirketService.cancelGeriDonusumTalebi(req.user.id, id);
    if (!data) return errorResponse(res, "Talep bulunamadı veya iptal edilemez durumda.", 400);
    return successResponse(res, "Talep iptal edildi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

module.exports = {
  getMe,
  createGeriDonusumTalebi,
  getMyGeriDonusumTalepleri,
  updateGeriDonusumTalebi,
  cancelGeriDonusumTalebi,
};
