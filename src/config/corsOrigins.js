const net = require("node:net");

function isPrivateIpv4(hostname) {
  if (net.isIP(hostname) !== 4) return false;

  const octets = hostname.split(".").map(Number);
  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function isDevelopmentLanOrigin(origin, nodeEnv = process.env.NODE_ENV) {
  if (nodeEnv === "production") return false;

  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" &&
      url.port === "5180" &&
      isPrivateIpv4(url.hostname)
    );
  } catch {
    return false;
  }
}

function createCorsOriginValidator(allowedOrigins, nodeEnv = process.env.NODE_ENV) {
  return (origin) =>
    !origin ||
    allowedOrigins.has(origin) ||
    isDevelopmentLanOrigin(origin, nodeEnv);
}

module.exports = {
  createCorsOriginValidator,
  isDevelopmentLanOrigin,
  isPrivateIpv4,
};
