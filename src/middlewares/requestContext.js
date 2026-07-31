const crypto = require("crypto");
const logger = require("../utils/logger");

function requestContext(req, res, next) {
  const incoming = req.get("X-Request-ID");
  req.id = incoming && /^[A-Za-z0-9._-]{8,128}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader("X-Request-ID", req.id);
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.info("http_request", {
      request_id: req.id,
      method: req.method,
      path: req.originalUrl?.split("?")[0],
      status: res.statusCode,
      duration_ms: Number(durationMs.toFixed(2)),
      role: req.user?.role,
      user_id: req.user?.id,
    });
  });
  next();
}

module.exports = requestContext;
