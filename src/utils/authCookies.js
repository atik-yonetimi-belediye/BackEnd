const crypto = require("crypto");

const AUTH_COOKIE_NAME = "auth_token";
const CSRF_COOKIE_NAME = "csrf_token";
const DEFAULT_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");
        const key =
          separatorIndex === -1 ? part : part.slice(0, separatorIndex);
        const rawValue =
          separatorIndex === -1 ? "" : part.slice(separatorIndex + 1);
        try {
          return [key, decodeURIComponent(rawValue)];
        } catch {
          return [key, rawValue];
        }
      })
  );
}

function getCookieOptions(httpOnly) {
  const configuredMaxAge = Number(process.env.AUTH_COOKIE_MAX_AGE_MS);
  return {
    httpOnly,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge:
      Number.isFinite(configuredMaxAge) && configuredMaxAge > 0
        ? configuredMaxAge
        : DEFAULT_COOKIE_MAX_AGE_MS,
  };
}

function setAuthCookies(res, token) {
  const csrfToken = crypto.randomBytes(32).toString("hex");
  res.cookie(AUTH_COOKIE_NAME, token, getCookieOptions(true));
  res.cookie(CSRF_COOKIE_NAME, csrfToken, getCookieOptions(false));
}

function clearAuthCookies(res) {
  const baseOptions = {
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  };
  res.clearCookie(AUTH_COOKIE_NAME, { ...baseOptions, httpOnly: true });
  res.clearCookie(CSRF_COOKIE_NAME, { ...baseOptions, httpOnly: false });
}

function getCookieToken(req) {
  return parseCookies(req.headers.cookie)[AUTH_COOKIE_NAME];
}

function isValidCsrfRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[CSRF_COOKIE_NAME];
  const headerToken = req.get("x-csrf-token");

  if (!cookieToken || !headerToken) return false;

  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);
  return (
    cookieBuffer.length === headerBuffer.length &&
    crypto.timingSafeEqual(cookieBuffer, headerBuffer)
  );
}

module.exports = {
  setAuthCookies,
  clearAuthCookies,
  getCookieToken,
  isValidCsrfRequest,
};
