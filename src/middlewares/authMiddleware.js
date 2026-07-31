const { verifyToken } = require("../utils/jwt");
const AppError = require("../utils/AppError");
const pool = require("../config/db");
const {
  getCookieToken,
  isValidCsrfRequest,
} = require("../utils/authCookies");

const accountQueries = {
  admin: `
    SELECT id, kullanici_adi, ad_soyad, mail, telefon, aktif_mi
    FROM yoneticiler
    WHERE id = $1
  `,
  cavus: `
    SELECT
      c.id, c.ad_soyad, c.telefon, c.aktif_mi, c.mahalle_id,
      m.ad AS mahalle_ad, m.ilce, m.il
    FROM cavuslar c
    JOIN mahalleler m ON m.id = c.mahalle_id
    WHERE c.id = $1
  `,
  sofor: `
    SELECT
      s.id, s.ad, s.soyad, s.telefon, s.aktif_mi, s.arac_id, s.cavus_id,
      a.plaka, a.arac_turu,
      a.aktif_mi AS arac_aktif_mi
    FROM soforler s
    LEFT JOIN araclar a ON a.id = s.arac_id
    WHERE s.id = $1
  `,
  sirket: `
    SELECT id, ad, adres, mail, telefon, aktif_mi, onay_durumu
    FROM sirketler
    WHERE id = $1
  `,
};

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    const cookieToken = getCookieToken(req);
    const token = bearerToken || cookieToken;

    if (!token) {
      return next(new AppError("Token bulunamadı.", 401));
    }

    if (authHeader && !bearerToken) {
      return next(new AppError("Geçersiz token formatı.", 401));
    }

    const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
    if (
      cookieToken &&
      !bearerToken &&
      mutatingMethods.has(req.method) &&
      !isValidCsrfRequest(req)
    ) {
      return next(new AppError("CSRF doğrulaması başarısız.", 403));
    }

    const decoded = verifyToken(token);
    const query = accountQueries[decoded.role];

    if (!query) {
      return next(new AppError("Token rolü geçersiz.", 401));
    }

    const accountResult = await pool.query(query, [decoded.id]);
    const account = accountResult.rows[0];

    if (!account || !account.aktif_mi) {
      return next(new AppError("Oturum artık geçerli değil.", 401));
    }

    if (
      decoded.role === "sirket" &&
      account.onay_durumu !== "onaylandi"
    ) {
      return next(new AppError("Şirket hesabı kullanıma açık değil.", 403));
    }

    if (
      decoded.role === "sofor" &&
      (!account.arac_id || !account.arac_aktif_mi)
    ) {
      return next(new AppError("Şoföre atanmış aktif araç bulunmuyor.", 403));
    }

    req.user = {
      ...decoded,
      ...account,
      role: decoded.role,
    };
    req.authSource = bearerToken ? "bearer" : "cookie";

    return next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    if (
      ["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(
        error.name
      )
    ) {
      return next(new AppError("Token geçersiz veya süresi dolmuş.", 401));
    }
    return next(error);
  }
}

module.exports = authMiddleware;
