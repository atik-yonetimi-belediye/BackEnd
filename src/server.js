require("dotenv").config({ quiet: true });

const app = require("./app");
const runMigrations = require("./scripts/migrateDatabase");

const PORT = process.env.PORT || 5000;

const unsafeSecrets = new Set([
  "development-only-change-this-secret",
  "generate-a-long-random-secret-for-each-environment",
]);

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET en az 32 karakter olmalıdır.");
}
if (
  process.env.NODE_ENV === "production" &&
  unsafeSecrets.has(process.env.JWT_SECRET)
) {
  throw new Error("Üretim ortamında örnek JWT_SECRET kullanılamaz.");
}

async function startServer() {
  await runMigrations();

  app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor.`);
  });
}

startServer().catch((error) => {
  console.error("Sunucu başlatılamadı:", error);
  process.exit(1);
});
