const logger = require("../../utils/logger");
const { clientErrors, pilotEvents, operationDuration } = require("../../observability/metrics");

const allowedClientKinds = new Set(["error-boundary", "window-error", "unhandled-rejection"]);
const allowedEvents = new Set(["collection_success", "collection_queued", "collection_failed", "skip_success", "skip_queued", "skip_failed"]);

function clientError(req, res) {
  const { kind, message, stack, path } = req.body || {};
  if (!allowedClientKinds.has(kind) || typeof message !== "string") return res.status(400).json({ success: false, message: "Geçersiz hata raporu." });
  clientErrors.inc({ kind });
  logger.warn("frontend_error", { request_id: req.id, kind, error_message: message.slice(0, 500), stack: typeof stack === "string" ? stack.slice(0, 2000) : undefined, path: typeof path === "string" ? path.slice(0, 300) : undefined });
  return res.status(202).json({ success: true });
}

function telemetry(req, res) {
  const { event, duration_ms } = req.body || {};
  if (!allowedEvents.has(event)) return res.status(400).json({ success: false, message: "Geçersiz telemetri olayı." });
  pilotEvents.inc({ event, role: req.user.role });
  if (Number.isFinite(duration_ms) && duration_ms >= 0 && duration_ms <= 600000) operationDuration.observe({ event, role: req.user.role }, duration_ms / 1000);
  logger.info("pilot_event", { request_id: req.id, event, role: req.user.role, user_id: req.user.id, duration_ms });
  return res.status(202).json({ success: true });
}

module.exports = { clientError, telemetry };
