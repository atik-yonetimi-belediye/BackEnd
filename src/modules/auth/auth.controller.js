const authService = require("./auth.service");
const { successResponse, errorResponse } = require("../../utils/response");
const {
  setAuthCookies,
  clearAuthCookies,
} = require("../../utils/authCookies");

function createSessionResponse(res, message, data) {
  setAuthCookies(res, data.token);
  return successResponse(res, message, { user: data.user });
}

async function loginAdmin(req, res) {
  try {
    const { kullanici_adi, sifre } = req.body;

    if (!kullanici_adi || !sifre) {
      return errorResponse(res, "Kullanıcı adı ve şifre zorunludur.", 400);
    }

    const data = await authService.loginAdmin(kullanici_adi, sifre);

    return createSessionResponse(res, "Yönetici girişi başarılı.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function loginCavus(req, res) {
  try {
    const { telefon, sifre } = req.body;

    if (!telefon || !sifre) {
      return errorResponse(res, "Telefon ve şifre zorunludur.", 400);
    }

    const data = await authService.loginCavus(telefon, sifre);

    return createSessionResponse(res, "Çavuş girişi başarılı.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function loginSofor(req, res) {
  try {
    const { telefon, sifre } = req.body;

    if (!telefon || !sifre) {
      return errorResponse(res, "Telefon ve şifre zorunludur.", 400);
    }

    const data = await authService.loginSofor(telefon, sifre);

    return createSessionResponse(res, "Şoför girişi başarılı.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function loginSirket(req, res) {
  try {
    const { mail, sifre } = req.body;

    if (!mail || !sifre) {
      return errorResponse(res, "Mail ve şifre zorunludur.", 400);
    }

    const data = await authService.loginSirket(mail, sifre);

    return createSessionResponse(res, "Şirket girişi başarılı.", data);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function registerSirket(req, res) {
  try {
    const { ad, adres, mail, telefon, sifre } = req.body;

    if (!ad || !mail || !telefon || !sifre) {
      return errorResponse(
        res,
        "Ad, mail, telefon ve şifre alanları zorunludur.",
        400
      );
    }

    const data = await authService.registerSirket({
      ad,
      adres,
      mail,
      telefon,
      sifre,
    });

    return successResponse(
      res,
      "Şirket kaydı oluşturuldu. Yönetici onayı bekleniyor.",
      data,
      201
    );
  } catch (error) {
    if (error.code === "23505") {
      return errorResponse(
        res,
        "Bu mail veya telefon ile kayıtlı bir şirket zaten var.",
        409
      );
    }

    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function getSession(req, res) {
  return successResponse(res, "Oturum geçerli.", { user: req.user });
}

async function logout(req, res) {
  clearAuthCookies(res);
  return successResponse(res, "Oturum kapatıldı.");
}

module.exports = {
  loginAdmin,
  loginCavus,
  loginSofor,
  loginSirket,
  registerSirket,
  getSession,
  logout,
};
