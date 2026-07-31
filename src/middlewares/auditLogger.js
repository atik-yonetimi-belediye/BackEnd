const pool = require("../config/db");
const logger = require("../utils/logger");

function sanitize(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sanitize);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/sifre|password|token|secret/i.test(key)).map(([key, item]) => [key, sanitize(item)]));
}

function auditLogger(req, res, next) {
  res.on("finish", () => {
    if (req.user?.role !== "admin" || !["POST", "PUT", "PATCH", "DELETE"].includes(req.method) || res.statusCode >= 400) return;
    pool.query(
      `INSERT INTO audit_logs (actor_role, actor_id, action, entity_path, request_id, request_data, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [req.user.role, req.user.id, req.method, req.originalUrl.split("?")[0], req.id, JSON.stringify(sanitize(req.body)), req.ip]
    ).catch((error) => logger.error("audit_log_write_failed", { request_id: req.id, error }));
  });
  next();
}

module.exports = auditLogger;
