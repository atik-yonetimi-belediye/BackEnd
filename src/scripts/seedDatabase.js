const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function seed() {
  try {
    const sqlPath = path.join(
      __dirname,
      "../../../Database/belediye-AtikYonetimi-veritabani.sql"
    );
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    console.log("Veritabanı sıfırlanıyor ve UTF-8 Türkçe tohum verileri yükleniyor...");
    await pool.query("SET client_encoding = 'UTF8';");
    await pool.query(sql);
    console.log("✅ Veritabanı başarıyla UTF-8 olarak güncellendi ve tohumlandı!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Tohumlama hatası:", err);
    process.exit(1);
  }
}

seed();
