const fs = require("fs");
const path = require("path");
const AppError = require("./AppError");

const uploadsRoot = path.resolve(__dirname, "..", "..", "uploads");
const sikayetUploadDir = path.join(uploadsRoot, "sikayetler");

fs.mkdirSync(sikayetUploadDir, { recursive: true });

function isWithinDirectory(filePath, directory) {
  const relative = path.relative(directory, path.resolve(filePath));
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function unlinkIfSafe(filePath) {
  if (!filePath || !isWithinDirectory(filePath, uploadsRoot)) return;

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function cleanupUploadedFiles(files = []) {
  await Promise.allSettled(files.map((file) => unlinkIfSafe(file.path)));
}

function photoUrlToFilePath(photoUrl) {
  if (
    typeof photoUrl !== "string" ||
    !photoUrl.startsWith("/uploads/sikayetler/")
  ) {
    return null;
  }

  const filename = path.basename(photoUrl);
  const filePath = path.join(sikayetUploadDir, filename);
  return isWithinDirectory(filePath, sikayetUploadDir) ? filePath : null;
}

async function deleteStoredPhotoUrls(photoUrls = []) {
  await Promise.allSettled(
    photoUrls
      .map(photoUrlToFilePath)
      .filter(Boolean)
      .map((filePath) => unlinkIfSafe(filePath))
  );
}

function detectImageType(buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  const pngSignature = "89504e470d0a1a0a";
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).toString("hex") === pngSignature
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

async function validateUploadedImageSignatures(req, res, next) {
  const files = req.files || [];

  try {
    for (const file of files) {
      const fileContent = await fs.promises.readFile(file.path);
      const buffer = fileContent.subarray(0, 12);

      const detectedMime = detectImageType(buffer);
      const normalizedMime =
        file.mimetype === "image/jpg" ? "image/jpeg" : file.mimetype;

      if (!detectedMime || detectedMime !== normalizedMime) {
        throw new AppError(
          "Fotoğraf içeriği uzantı veya MIME tipiyle eşleşmiyor.",
          400
        );
      }
    }

    return next();
  } catch (error) {
    await cleanupUploadedFiles(files);
    req.files = [];
    return next(error);
  }
}

module.exports = {
  sikayetUploadDir,
  cleanupUploadedFiles,
  deleteStoredPhotoUrls,
  validateUploadedImageSignatures,
  detectImageType,
};
