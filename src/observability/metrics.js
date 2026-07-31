const client = require("prom-client");
const fs = require("fs/promises");
const pool = require("../config/db");

client.collectDefaultMetrics({ prefix: "atik_" });
const httpDuration = new client.Histogram({ name: "atik_http_request_duration_seconds", help: "HTTP istek süresi", labelNames: ["method", "route", "status"], buckets: [0.05, 0.1, 0.2, 0.5, 1, 2.5, 5] });
const httpErrors = new client.Counter({ name: "atik_http_errors_total", help: "HTTP 5xx toplamı", labelNames: ["route"] });
const clientErrors = new client.Counter({ name: "atik_frontend_errors_total", help: "Frontend hata toplamı", labelNames: ["kind"] });
const pilotEvents = new client.Counter({ name: "atik_pilot_events_total", help: "Saha pilot olayları", labelNames: ["event", "role"] });
const operationDuration = new client.Histogram({ name: "atik_pilot_operation_duration_seconds", help: "Saha işlem süresi", labelNames: ["event", "role"], buckets: [1, 3, 5, 10, 20, 30, 60, 120] });
const dbTotal = new client.Gauge({ name: "atik_db_pool_total", help: "Toplam DB bağlantısı" });
const dbIdle = new client.Gauge({ name: "atik_db_pool_idle", help: "Boş DB bağlantısı" });
const dbWaiting = new client.Gauge({ name: "atik_db_pool_waiting", help: "DB bağlantısı bekleyen istek" });
const diskUsage = new client.Gauge({ name: "atik_upload_disk_usage_ratio", help: "Upload diski kullanım oranı" });

function normalizedRoute(req) { return (req.baseUrl + (req.route?.path || req.path)).replace(/\/\d+(?=\/|$)/g, "/:id"); }
function metricsMiddleware(req, res, next) {
  const end = httpDuration.startTimer();
  res.on("finish", () => {
    const route = normalizedRoute(req);
    end({ method: req.method, route, status: String(res.statusCode) });
    if (res.statusCode >= 500) httpErrors.inc({ route });
  });
  next();
}

async function renderMetrics() {
  dbTotal.set(pool.totalCount); dbIdle.set(pool.idleCount); dbWaiting.set(pool.waitingCount);
  try {
    const stats = await fs.statfs(process.env.UPLOADS_PATH || "uploads");
    diskUsage.set(1 - (Number(stats.bavail) / Number(stats.blocks)));
  } catch { diskUsage.set(0); }
  return client.register.metrics();
}

module.exports = { metricsMiddleware, renderMetrics, contentType: client.register.contentType, clientErrors, pilotEvents, operationDuration };
