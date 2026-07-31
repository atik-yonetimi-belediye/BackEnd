const sikayetService = require("./sikayet.service");
const { successResponse, errorResponse } = require("../../utils/response");

const allowedAtikTurleri = ["kati_atik", "geri_donusum"];

const allowedSikayetKategorileri = [
  "konteyner_dolu",
  "konteyner_kirik",
  "kotu_koku",
  "cop_tasmasi",
  "zamaninda_toplanmadi",
  "diger",
];

const allowedSikayetDurumlari = [
  "bekliyor",
  "inceleniyor",
  "cozuldu",
  "reddedildi",
];

async function createSikayet(req, res) {
  try {
    const vatandas_ad_soyad = req.body.vatandas_ad_soyad?.trim();
    const vatandas_telefon = req.body.vatandas_telefon?.trim();
    const konteyner_id = req.body.konteyner_id;
    const sikayet_turu = req.body.sikayet_turu?.trim();
    const sikayet_kategorisi = req.body.sikayet_kategorisi?.trim() || "diger";
    const sikayet_metni = req.body.sikayet_metni?.trim();

    if (
      !vatandas_ad_soyad ||
      !vatandas_telefon ||
      !konteyner_id ||
      !sikayet_turu ||
      !sikayet_metni
    ) {
      return errorResponse(
        res,
        "Ad soyad, telefon, konteyner id, şikayet türü ve şikayet metni zorunludur.",
        400
      );
    }

    if (!allowedAtikTurleri.includes(sikayet_turu)) {
      return errorResponse(res, "Geçersiz şikayet türü.", 400);
    }

    if (!allowedSikayetKategorileri.includes(sikayet_kategorisi)) {
      return errorResponse(res, "Geçersiz şikayet kategorisi.", 400);
    }

    const files = req.files || [];

    const data = await sikayetService.createSikayet(
      {
        vatandas_ad_soyad,
        vatandas_telefon,
        konteyner_id,
        sikayet_turu,
        sikayet_kategorisi,
        sikayet_metni,
      },
      files
    );
    req.uploadsPersisted = true;

    return successResponse(res, "Şikayet başarıyla oluşturuldu.", data, 201);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function getAllSikayetler(req, res) {
  try {
    const data = await sikayetService.getAllSikayetler(req.query);

    return successResponse(res, "Şikayetler başarıyla listelendi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function getSikayetById(req, res) {
  try {
    const { id } = req.params;

    const data = await sikayetService.getSikayetById(id);

    if (!data) {
      return errorResponse(res, "Şikayet bulunamadı.", 404);
    }

    return successResponse(res, "Şikayet detayı getirildi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function updateSikayetDurumu(req, res) {
  try {
    const { id } = req.params;
    const { durum, yonetici_notu } = req.body;

    if (!durum) {
      return errorResponse(res, "Durum alanı zorunludur.", 400);
    }

    if (!allowedSikayetDurumlari.includes(durum)) {
      return errorResponse(res, "Geçersiz şikayet durumu.", 400);
    }

    const data = await sikayetService.updateSikayetDurumu(id, {
      durum,
      yonetici_notu,
    });

    if (!data) {
      return errorResponse(res, "Şikayet bulunamadı.", 404);
    }

    return successResponse(res, "Şikayet durumu güncellendi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function deleteSikayet(req, res) {
  try {
    const { id } = req.params;
    const data = await sikayetService.deleteSikayet(id);
    if (!data) return errorResponse(res, "Şikayet bulunamadı.", 404);
    return successResponse(res, "Şikayet arşivlendi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

module.exports = {
  createSikayet,
  getAllSikayetler,
  getSikayetById,
  updateSikayetDurumu,
  deleteSikayet,
};
