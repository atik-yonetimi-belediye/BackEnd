const multer = require("multer");
const crypto = require("crypto");
const { sikayetUploadDir } = require("../utils/uploadFiles");
const AppError = require("../utils/AppError");

const extensionsByMime = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, sikayetUploadDir);
  },
  filename: function (req, file, cb) {
    const extension = extensionsByMime[file.mimetype];
    cb(null, `sikayet-${crypto.randomUUID()}${extension}`);
  },
});

function fileFilter(req, file, cb) {
  const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(
      new AppError(
        "Sadece JPG, PNG veya WEBP formatında fotoğraf yüklenebilir.",
        400
      )
    );
  }

  cb(null, true);
}

const uploadSikayetFotograflari = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 3,
    fields: 10,
  },
});

module.exports = {
  uploadSikayetFotograflari,
};
