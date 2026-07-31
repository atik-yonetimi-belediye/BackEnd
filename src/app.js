const express = require("express");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const pool = require("./config/db");
const requestContext = require("./middlewares/requestContext");
const { createRateLimitStore } = require("./config/redis");
const auditLogger = require("./middlewares/auditLogger");
const authMiddleware = require("./middlewares/authMiddleware");
const observabilityController = require("./modules/observability/observability.controller");
const { metricsMiddleware, renderMetrics, contentType } = require("./observability/metrics");

const authRoutes = require("./modules/auth/auth.routes");
const mahalleRoutes = require("./modules/mahalle/mahalle.routes");
const konteynerRoutes = require("./modules/konteyner/konteyner.routes");
const cavusRoutes = require("./modules/cavus/cavus.routes");
const soforRoutes = require("./modules/sofor/sofor.routes");
const sikayetRoutes = require("./modules/sikayet/sikayet.routes");
const sirketRoutes = require("./modules/sirket/sirket.routes");
const recyclingRoutes = require("./modules/recycling/recycling.routes");
const adminRoutes = require("./modules/admin/admin.routes");
const publicRoutes = require("./modules/public/public.routes");

const AppError = require("./utils/AppError");
const asyncHandler = require("./utils/asyncHandler");
const errorMiddleware = require("./middlewares/errorMiddleware");

const app = express();

const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (
  !Number.isInteger(trustProxyHops) ||
  trustProxyHops < 0 ||
  trustProxyHops > 10
) {
  throw new Error("TRUST_PROXY_HOPS 0 ile 10 arasında tam sayı olmalıdır.");
}
app.set("trust proxy", trustProxyHops);
app.use(requestContext);
app.use(metricsMiddleware);

const defaultCorsOrigins = [
  "http://localhost:5180",
  "http://127.0.0.1:5180",
];
const allowedCorsOrigins = new Set(
  (process.env.CORS_ORIGINS || defaultCorsOrigins.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

// 1. HTTP Security Headers (Helmet)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

// 2. Rate Limiting (General API: 15 mins max 300 requests)
const generalLimiter = rateLimit({
  store: createRateLimitStore("rl:general:"),
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Çok fazla istek gönderildi. Lütfen bir süre sonra tekrar deneyiniz."
  }
});

// 3. Strict Auth Rate Limiter (Brute-Force prevention: 15 mins max 15 requests)
const authLimiter = rateLimit({
  store: createRateLimitStore("rl:auth:"),
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Çok sayıda hatalı veya üst üste deneme yapıldı. Lütfen 15 dakika bekleyiniz."
  }
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedCorsOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new AppError("Bu origin için CORS erişimine izin verilmiyor.", 403));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(auditLogger);

app.get("/metrics", asyncHandler(async (req, res) => {
  const expected = process.env.METRICS_TOKEN;
  if (expected && req.get("Authorization") !== `Bearer ${expected}`) throw new AppError("Yetkisiz metrik erişimi.", 401);
  res.set("Content-Type", contentType);
  res.send(await renderMetrics());
}));

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Atık Yönetimi Backend API çalışıyor.",
  });
});

const healthHandler = asyncHandler(async (req, res) => {
  await pool.query("SELECT 1");
  res.status(200).json({ success: true, status: "ok" });
});

app.get("/health", healthHandler);

// Apply rate limiters
app.use("/api/", generalLimiter);
app.use("/api/auth", authLimiter);
app.get("/api/health", healthHandler);
app.post("/api/client-errors", observabilityController.clientError);
app.post("/api/telemetry", authMiddleware, observabilityController.telemetry);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/mahalleler", mahalleRoutes);
app.use("/api/konteynerler", konteynerRoutes);
app.use("/api/cavus", cavusRoutes);
app.use("/api/sofor", soforRoutes);
app.use("/api/sikayetler", sikayetRoutes);
app.use("/api/sirket", sirketRoutes);
app.use("/api/recycling-requests", recyclingRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res, next) => {
  next(new AppError("Route bulunamadı.", 404));
});

app.use(errorMiddleware);

module.exports = app;
