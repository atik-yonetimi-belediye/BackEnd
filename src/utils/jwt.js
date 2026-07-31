const jwt = require("jsonwebtoken");

function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    algorithm: "HS256",
    issuer: "atik-yonetimi-api",
    audience: "atik-yonetimi-clients",
  });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: "atik-yonetimi-api",
    audience: "atik-yonetimi-clients",
  });
}

module.exports = {
  generateToken,
  verifyToken,
};
