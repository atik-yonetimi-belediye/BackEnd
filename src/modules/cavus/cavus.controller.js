const cavusService = require("./cavus.service");
const { successResponse, errorResponse } = require("../../utils/response");

const allowedAtikTurleri = ["kati_atik", "geri_donusum"];

async function getMe(req, res) {
  try {
    const data = await cavusService.getMe(req.user.id);

    if (!data) {
      return errorResponse(res, "Çavuş bilgisi bulunamadı.", 404);
    }

    return successResponse(res, "Çavuş bilgisi getirildi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function getMyKonteynerler(req, res) {
  try {
    const data = await cavusService.getMyKonteynerler(req.user.id, req.query);
    return successResponse(res, "Çavuşa ait konteynerler listelendi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function createKonteyner(req, res) {
  try {
    const { konteyner_kodu, tur, latitude, longitude } = req.body;

    if (!tur || latitude === undefined || longitude === undefined) {
      return errorResponse(
        res,
        "Tür, latitude ve longitude zorunludur.",
        400
      );
    }

    if (!allowedAtikTurleri.includes(tur)) {
      return errorResponse(res, "Geçersiz atık türü.", 400);
    }

    const data = await cavusService.createKonteyner(
      req.user.id,
      req.user.mahalle_id,
      {
        konteyner_kodu,
        tur,
        latitude,
        longitude,
      }
    );

    return successResponse(res, "Konteyner başarıyla oluşturuldu.", data, 201);
  } catch (error) {
    if (error.code === "23505") {
      return errorResponse(res, "Bu konteyner kodu zaten kullanılıyor.", 409);
    }

    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function passiveKonteyner(req, res) {
  try {
    const { id } = req.params;

    const data = await cavusService.passiveKonteyner(req.user.id, id);

    if (!data) {
      return errorResponse(
        res,
        "Konteyner bulunamadı veya bu çavuşa ait değil.",
        404
      );
    }

    return successResponse(res, "Konteyner pasif hale getirildi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function getMyAraclar(req, res) {
  try {
    const data = await cavusService.getMyAraclar(req.user.id, req.query);
    return successResponse(res, "Çavuşa ait araçlar listelendi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function createArac(req, res) {
  try {
    const { plaka, arac_turu } = req.body;

    if (!plaka || !arac_turu) {
      return errorResponse(res, "Plaka ve araç türü zorunludur.", 400);
    }

    if (!allowedAtikTurleri.includes(arac_turu)) {
      return errorResponse(res, "Geçersiz araç türü.", 400);
    }

    const data = await cavusService.createArac(req.user.id, {
      plaka,
      arac_turu,
    });

    return successResponse(res, "Araç başarıyla oluşturuldu.", data, 201);
  } catch (error) {
    if (error.code === "23505") {
      return errorResponse(res, "Bu plaka zaten kullanılıyor.", 409);
    }

    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function passiveArac(req, res) {
  try {
    const { id } = req.params;

    const data = await cavusService.passiveArac(req.user.id, id);

    if (!data) {
      return errorResponse(res, "Araç bulunamadı veya bu çavuşa ait değil.", 404);
    }

    return successResponse(res, "Araç pasif hale getirildi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function getMySoforler(req, res) {
  try {
    const data = await cavusService.getMySoforler(req.user.id, req.query);
    return successResponse(res, "Çavuşa ait şoförler listelendi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function createSofor(req, res) {
  try {
    const { ad, soyad, telefon, sifre, arac_id } = req.body;

    if (!ad || !soyad || !telefon || !sifre || !arac_id) {
      return errorResponse(
        res,
        "Ad, soyad, telefon, şifre ve araç id zorunludur.",
        400
      );
    }

    const data = await cavusService.createSofor(req.user.id, {
      ad,
      soyad,
      telefon,
      sifre,
      arac_id,
    });

    return successResponse(res, "Şoför başarıyla oluşturuldu.", data, 201);
  } catch (error) {
    if (error.code === "23505") {
      return errorResponse(
        res,
        "Bu telefon kullanılıyor veya araç başka bir şoföre atanmış.",
        409
      );
    }

    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function passiveSofor(req, res) {
  try {
    const { id } = req.params;

    const data = await cavusService.passiveSofor(req.user.id, id);

    if (!data) {
      return errorResponse(
        res,
        "Şoför bulunamadı veya bu çavuşa ait değil.",
        404
      );
    }

    return successResponse(res, "Şoför pasif hale getirildi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function getMyToplamaKayitlari(req, res) {
  try {
    const data = await cavusService.getMyToplamaKayitlari(
      req.user.id,
      req.query
    );
    return successResponse(res, "Toplama kayıtları başarıyla getirildi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function updateArac(req, res) {
  try {
    const { id } = req.params;
    const { plaka, arac_turu } = req.body;
    const data = await cavusService.updateArac(req.user.id, id, { plaka, arac_turu });
    if (!data) return errorResponse(res, "Araç bulunamadı.", 404);
    return successResponse(res, "Araç güncellendi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function updateSoforArac(req, res) {
  try {
    const { id } = req.params;
    const { arac_id } = req.body;
    const data = await cavusService.updateSoforArac(req.user.id, id, arac_id);
    if (!data) return errorResponse(res, "Şoför bulunamadı.", 404);
    return successResponse(res, "Şoför aracı güncellendi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

module.exports = {
  getMe,
  getMyKonteynerler,
  createKonteyner,
  passiveKonteyner,
  getMyAraclar,
  createArac,
  updateArac,
  passiveArac,
  getMySoforler,
  createSofor,
  updateSoforArac,
  passiveSofor,
  getMyToplamaKayitlari,
};
