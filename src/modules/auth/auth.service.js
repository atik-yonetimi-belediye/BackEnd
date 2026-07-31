const bcrypt = require("bcrypt");
const pool = require("../../config/db");
const { generateToken } = require("../../utils/jwt");
const { normalizePhone } = require("../../utils/phone");

const DUMMY_PASSWORD_HASH =
  "$2b$12$c2WZvTqKV8d58y7XeV/8BOo8n9Zd6XDg.tfyHpEQ4ANZduJ/hDt3y";

async function checkPassword(inputPassword, hashedPassword) {
  return bcrypt.compare(inputPassword, hashedPassword);
}

function createAuthError() {
  const error = new Error(
    "Giriş bilgileri geçersiz veya hesap kullanıma açık değil."
  );
  error.statusCode = 401;
  return error;
}

async function loginAdmin(kullanici_adi, sifre) {
  const result = await pool.query(
    `
    SELECT id, kullanici_adi, sifre, ad_soyad, mail, telefon, aktif_mi
    FROM yoneticiler
    WHERE kullanici_adi = $1
    `,
    [kullanici_adi]
  );

  const admin = result.rows[0];
  const passwordMatch = await checkPassword(
    sifre,
    admin?.sifre || DUMMY_PASSWORD_HASH
  );

  if (!admin || !admin.aktif_mi || !passwordMatch) {
    throw createAuthError();
  }

  const token = generateToken({
    id: admin.id,
    role: "admin",
    kullanici_adi: admin.kullanici_adi,
  });

  return {
    token,
    user: {
      id: admin.id,
      role: "admin",
      kullanici_adi: admin.kullanici_adi,
      ad_soyad: admin.ad_soyad,
      mail: admin.mail,
      telefon: admin.telefon,
    },
  };
}

async function loginCavus(telefon, sifre) {
  const normalizedPhone = normalizePhone(telefon);

  const result = await pool.query(
    `
    SELECT 
      c.id,
      c.ad_soyad,
      c.telefon,
      c.sifre,
      c.mahalle_id,
      c.aktif_mi,
      m.ad AS mahalle_ad,
      m.ilce,
      m.il
    FROM cavuslar c
    JOIN mahalleler m ON m.id = c.mahalle_id
    WHERE c.telefon = $1
    `,
    [normalizedPhone]
  );

  const cavus = result.rows[0];
  const passwordMatch = await checkPassword(
    sifre,
    cavus?.sifre || DUMMY_PASSWORD_HASH
  );

  if (!cavus || !cavus.aktif_mi || !passwordMatch) {
    throw createAuthError();
  }

  const token = generateToken({
    id: cavus.id,
    role: "cavus",
    telefon: cavus.telefon,
    mahalle_id: cavus.mahalle_id,
  });

  return {
    token,
    user: {
      id: cavus.id,
      role: "cavus",
      ad_soyad: cavus.ad_soyad,
      telefon: cavus.telefon,
      mahalle_id: cavus.mahalle_id,
      mahalle_ad: cavus.mahalle_ad,
      ilce: cavus.ilce,
      il: cavus.il,
    },
  };
}

async function loginSofor(telefon, sifre) {
  const normalizedPhone = normalizePhone(telefon);

  const result = await pool.query(
    `
    SELECT 
      s.id,
      s.ad,
      s.soyad,
      s.telefon,
      s.sifre,
      s.arac_id,
      s.cavus_id,
      s.aktif_mi,
      a.plaka,
      a.arac_turu,
      a.aktif_mi AS arac_aktif_mi
    FROM soforler s
    LEFT JOIN araclar a ON a.id = s.arac_id
    WHERE s.telefon = $1
    `,
    [normalizedPhone]
  );

  const sofor = result.rows[0];
  const passwordMatch = await checkPassword(
    sifre,
    sofor?.sifre || DUMMY_PASSWORD_HASH
  );

  if (
    !sofor ||
    !sofor.aktif_mi ||
    !sofor.arac_id ||
    !sofor.arac_aktif_mi ||
    !passwordMatch
  ) {
    throw createAuthError();
  }

  const token = generateToken({
    id: sofor.id,
    role: "sofor",
    telefon: sofor.telefon,
    arac_id: sofor.arac_id,
    arac_turu: sofor.arac_turu,
    cavus_id: sofor.cavus_id,
  });

  return {
    token,
    user: {
      id: sofor.id,
      role: "sofor",
      ad: sofor.ad,
      soyad: sofor.soyad,
      telefon: sofor.telefon,
      arac_id: sofor.arac_id,
      plaka: sofor.plaka,
      arac_turu: sofor.arac_turu,
      cavus_id: sofor.cavus_id,
    },
  };
}

async function loginSirket(mail, sifre) {
  const result = await pool.query(
    `
    SELECT id, ad, adres, mail, telefon, sifre, onay_durumu, aktif_mi
    FROM sirketler
    WHERE LOWER(mail) = LOWER($1)
    `,
    [mail]
  );

  const sirket = result.rows[0];
  const passwordMatch = await checkPassword(
    sifre,
    sirket?.sifre || DUMMY_PASSWORD_HASH
  );

  if (
    !sirket ||
    !sirket.aktif_mi ||
    sirket.onay_durumu !== "onaylandi" ||
    !passwordMatch
  ) {
    throw createAuthError();
  }

  const token = generateToken({
    id: sirket.id,
    role: "sirket",
    mail: sirket.mail,
  });

  return {
    token,
    user: {
      id: sirket.id,
      role: "sirket",
      ad: sirket.ad,
      adres: sirket.adres,
      mail: sirket.mail,
      telefon: sirket.telefon,
      onay_durumu: sirket.onay_durumu,
    },
  };
}

async function registerSirket(data) {
  const { ad, adres, mail, telefon, sifre } = data;

  const normalizedPhone = normalizePhone(telefon);
  const hashedPassword = await bcrypt.hash(sifre, 12);

  const result = await pool.query(
    `
    INSERT INTO sirketler
      (ad, adres, mail, telefon, sifre, onay_durumu, aktif_mi)
    VALUES
      ($1, $2, $3, $4, $5, 'bekliyor', true)
    RETURNING id, ad, adres, mail, telefon, onay_durumu, aktif_mi, created_at
    `,
    [ad, adres || null, mail.toLowerCase(), normalizedPhone, hashedPassword]
  );

  return result.rows[0];
}

module.exports = {
  loginAdmin,
  loginCavus,
  loginSofor,
  loginSirket,
  registerSirket,
};
