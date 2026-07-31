const soforService = require("./sofor.service");
const { successResponse, errorResponse } = require("../../utils/response");

const allowedDurumlar = ["toplandi", "atlanildi"];

async function getMe(req, res) {
  try {
    const data = await soforService.getMe(req.user.id);

    if (!data) {
      return errorResponse(res, "Şoför bilgisi bulunamadı.", 404);
    }

    return successResponse(res, "Şoför bilgisi getirildi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function getAvailableKonteynerlerForSofor(req, res) {
  try {
    const data = await soforService.getAvailableKonteynerlerForSofor(
      req.user.id,
      req.query
    );

    return successResponse(
      res,
      "Şoförün araç türüne uygun konteynerler listelendi.",
      data
    );
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function createToplamaKaydi(req, res) {
  try {
    const { konteyner_id, durum, sebep, diger_aciklama } = req.body;
    const idempotencyKey = req.get("Idempotency-Key") || null;

    if (idempotencyKey && !/^[A-Za-z0-9-]{20,64}$/.test(idempotencyKey)) {
      return errorResponse(res, "Geçersiz tekrar gönderim anahtarı.", 400);
    }

    if (!konteyner_id || !durum) {
      return errorResponse(res, "Konteyner id ve durum zorunludur.", 400);
    }

    if (!allowedDurumlar.includes(durum)) {
      return errorResponse(res, "Geçersiz toplama durumu.", 400);
    }

    if (durum === "atlanildi" && !sebep) {
      return errorResponse(
        res,
        "Atlanılan konteyner için sebep zorunludur.",
        400
      );
    }

    if (durum === "toplandi" && (sebep || diger_aciklama)) {
      return errorResponse(
        res,
        "Toplandı durumunda sebep veya açıklama gönderilmemelidir.",
        400
      );
    }

    const data = await soforService.createToplamaKaydi(req.user.id, {
      konteyner_id,
      durum,
      sebep,
      diger_aciklama,
      idempotency_key: idempotencyKey,
    });

    return successResponse(res, "Toplama kaydı başarıyla oluşturuldu.", data, 201);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function getMyToplamaKayitlari(req, res) {
  try {
    const data = await soforService.getMyToplamaKayitlari(
      req.user.id,
      req.query
    );

    return successResponse(res, "Şoför toplama geçmişi listelendi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

module.exports = {
  getMe,
  getAvailableKonteynerlerForSofor,
  createToplamaKaydi,
  getMyToplamaKayitlari,
};
