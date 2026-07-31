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

async function login(req, res) {
  try {
    const { identifier, sifre } = req.body;
    const data = await authService.login(identifier, sifre);

    return createSessionResponse(res, "Giriş başarılı.", data);
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
  login,
  registerSirket,
  getSession,
  logout,
};
