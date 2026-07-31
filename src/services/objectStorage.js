const fs = require("fs/promises");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const endpoint = process.env.S3_ENDPOINT?.replace(/\/+$/, "");
const bucket = process.env.S3_BUCKET;
const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.replace(/\/+$/, "");
const partiallyConfigured = Boolean(endpoint || bucket || publicBaseUrl);
if (partiallyConfigured && !(endpoint && bucket && publicBaseUrl)) {
  throw new Error("S3_ENDPOINT, S3_BUCKET ve S3_PUBLIC_BASE_URL birlikte tanımlanmalıdır.");
}
const enabled = Boolean(endpoint && bucket && publicBaseUrl);
const client = enabled ? new S3Client({
  endpoint,
  region: process.env.S3_REGION || "us-east-1",
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  } : undefined,
}) : null;

async function storeComplaintFiles(files = []) {
  if (!enabled) return files.map((file) => ({ ...file, storageUrl: `/uploads/sikayetler/${file.filename}` }));
  const stored = [];
  try {
    for (const file of files) {
      const key = `complaints/${file.filename}`;
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: await fs.readFile(file.path), ContentType: file.mimetype }));
      await fs.unlink(file.path).catch(() => {});
      stored.push({ ...file, storageUrl: `${publicBaseUrl}/${key}`, storageKey: key });
    }
  } catch (error) {
    await deleteRemotePhotoUrls(stored.map((file) => file.storageUrl));
    throw error;
  }
  return stored;
}

async function deleteRemotePhotoUrls(urls = []) {
  if (!enabled) return;
  const prefix = `${publicBaseUrl}/`;
  await Promise.allSettled(urls.filter((url) => url.startsWith(prefix)).map((url) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key: url.slice(prefix.length) }))));
}

module.exports = { storeComplaintFiles, deleteRemotePhotoUrls, objectStorageEnabled: enabled };
