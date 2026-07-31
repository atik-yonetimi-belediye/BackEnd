const adminService = require("./admin.service");
const { successResponse, errorResponse } = require("../../utils/response");

const allowedAtikTurleri = ["kati_atik", "geri_donusum"];

const allowedSirketOnayDurumlari = [
  "bekliyor",
  "onaylandi",
  "reddedildi",
  "pasif",
];

const allowedToplamaDurumlari = ["toplandi", "atlanildi"];

function parseBoolean(value) {
  if (value === undefined) return undefined;
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}

async function getDashboard(req, res) {
  try {
    const data = await adminService.getDashboard();

    return successResponse(res, "Yönetici panel özeti getirildi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function getAllCavuslar(req, res) {
  try {
    const data = await adminService.getAllCavuslar(req.query);

    return successResponse(res, "Çavuşlar listelendi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function getAllSoforler(req, res) {
  try {
    const data = await adminService.getAllSoforler(req.query);

    return successResponse(res, "Şoförler listelendi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function getAllSirketler(req, res) {
  try {
    const { onay_durumu, aktif_mi } = req.query;

    if (onay_durumu && !allowedSirketOnayDurumlari.includes(onay_durumu)) {
      return errorResponse(res, "Geçersiz şirket onay durumu.", 400);
    }

    const filters = {};
    filters.page = req.query.page;
    filters.limit = req.query.limit;

    if (onay_durumu) {
      filters.onay_durumu = onay_durumu;
    }

    const parsedAktifMi = parseBoolean(aktif_mi);
    if (parsedAktifMi !== undefined) {
      filters.aktif_mi = parsedAktifMi;
    }

    const data = await adminService.getAllSirketler(filters);

    return successResponse(res, "Şirketler listelendi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function updateSirketOnayDurumu(req, res) {
  try {
    const { id } = req.params;
    const { onay_durumu } = req.body;

    if (!onay_durumu) {
      return errorResponse(res, "onay_durumu alanı zorunludur.", 400);
    }

    if (!allowedSirketOnayDurumlari.includes(onay_durumu)) {
      return errorResponse(res, "Geçersiz şirket onay durumu.", 400);
    }

    const data = await adminService.updateSirketOnayDurumu(id, {
      onay_durumu,
    });

    if (!data) {
      return errorResponse(res, "Şirket bulunamadı.", 404);
    }

    return successResponse(res, "Şirket onay durumu güncellendi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function getAllKonteynerler(req, res) {
  try {
    const { tur, mahalle_id, aktif_mi } = req.query;

    if (tur && !allowedAtikTurleri.includes(tur)) {
      return errorResponse(res, "Geçersiz konteyner türü.", 400);
    }

    const filters = {};
    filters.page = req.query.page;
    filters.limit = req.query.limit;

    if (tur) {
      filters.tur = tur;
    }

    if (mahalle_id) {
      filters.mahalle_id = mahalle_id;
    }

    const parsedAktifMi = parseBoolean(aktif_mi);
    if (parsedAktifMi !== undefined) {
      filters.aktif_mi = parsedAktifMi;
    }

    const data = await adminService.getAllKonteynerler(filters);

    return successResponse(res, "Konteynerler listelendi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function getAllAraclar(req, res) {
  try {
    const { arac_turu, cavus_id, aktif_mi } = req.query;

    if (arac_turu && !allowedAtikTurleri.includes(arac_turu)) {
      return errorResponse(res, "Geçersiz araç türü.", 400);
    }

    const filters = {};
    filters.page = req.query.page;
    filters.limit = req.query.limit;

    if (arac_turu) {
      filters.arac_turu = arac_turu;
    }

    if (cavus_id) {
      filters.cavus_id = cavus_id;
    }

    const parsedAktifMi = parseBoolean(aktif_mi);
    if (parsedAktifMi !== undefined) {
      filters.aktif_mi = parsedAktifMi;
    }

    const data = await adminService.getAllAraclar(filters);

    return successResponse(res, "Araçlar listelendi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function getAllToplamaKayitlari(req, res) {
  try {
    const { durum, sofor_id, konteyner_id, mahalle_id, date_from, date_to } =
      req.query;

    if (durum && !allowedToplamaDurumlari.includes(durum)) {
      return errorResponse(res, "Geçersiz toplama durumu.", 400);
    }

    const filters = {};
    filters.page = req.query.page;
    filters.limit = req.query.limit;

    if (durum) {
      filters.durum = durum;
    }

    if (sofor_id) {
      filters.sofor_id = sofor_id;
    }

    if (konteyner_id) {
      filters.konteyner_id = konteyner_id;
    }

    if (mahalle_id) {
      filters.mahalle_id = mahalle_id;
    }

    if (date_from) {
      filters.date_from = date_from;
    }

    if (date_to) {
      filters.date_to = date_to;
    }

    const data = await adminService.getAllToplamaKayitlari(filters);

    return successResponse(res, "Toplama kayıtları listelendi.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

module.exports = {
  getDashboard,
  getAllCavuslar,
  getAllSoforler,
  getAllSirketler,
  updateSirketOnayDurumu,
  getAllKonteynerler,
  getAllAraclar,
  getAllToplamaKayitlari,
};
