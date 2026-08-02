const multer = require("multer");
const { cleanupUploadedFiles } = require("../utils/uploadFiles");
const logger = require("../utils/logger");

async function errorMiddleware(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (req.files?.length && !req.uploadsPersisted) {
    await cleanupUploadedFiles([...(Array.isArray(req.files) ? req.files : []), ...(req.file ? [req.file] : [])]);
  }

  let statusCode = err.statusCode || err.status || 500;
  let operationalMessage = err.message;

  if (err instanceof multer.MulterError) {
    statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    operationalMessage =
      err.code === "LIMIT_FILE_SIZE"
        ? "Bir fotoğraf en fazla 5 MB olabilir."
        : "Fotoğraf yükleme sınırları aşıldı veya alan adı geçersiz.";
  }

  if (err.type === "entity.too.large") {
    statusCode = 413;
    operationalMessage = "İstek gövdesi izin verilen boyutu aşıyor.";
  }

  const message =
    statusCode === 500
      ? "Sunucuda beklenmeyen bir hata oluştu."
      : operationalMessage;

  if (statusCode >= 500) {
    logger.error("request_failed", { request_id: req.id, method: req.method, path: req.originalUrl?.split("?")[0], error: err });
  }

  return res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors || null,
    request_id: req.id,
  });
}

module.exports = errorMiddleware;
