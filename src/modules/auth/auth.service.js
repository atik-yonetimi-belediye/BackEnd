const bcrypt = require("bcrypt");
const pool = require("../../config/db");
const { generateToken } = require("../../utils/jwt");
const { normalizePhone } = require("../../utils/phone");

const DUMMY_PASSWORD_HASH =
  "$2b$12$c2WZvTqKV8d58y7XeV/8BOo8n9Zd6XDg.tfyHpEQ4ANZduJ/hDt3y";

const PHONE_CANDIDATES_QUERY = `
  SELECT 'admin' AS role, id, sifre FROM yoneticiler WHERE telefon = $1
  UNION ALL
  SELECT 'cavus' AS role, id, sifre FROM cavuslar WHERE telefon = $1
  UNION ALL
  SELECT 'sofor' AS role, id, sifre FROM soforler WHERE telefon = $1
  UNION ALL
  SELECT 'sirket' AS role, id, sifre FROM sirketler WHERE telefon = $1
`;

const USERNAME_CANDIDATES_QUERY = `
  SELECT 'admin' AS role, id, sifre
  FROM yoneticiler
  WHERE LOWER(kullanici_adi) = LOWER($1)
`;

const ACCOUNT_QUERIES = {
  admin: `
    SELECT id, kullanici_adi, ad_soyad, mail, telefon, aktif_mi
    FROM yoneticiler
    WHERE id = $1
  `,
  cavus: `
    SELECT
      c.id, c.ad_soyad, c.telefon, c.mahalle_id, c.aktif_mi,
      m.ad AS mahalle_ad, m.ilce, m.il
    FROM cavuslar c
    JOIN mahalleler m ON m.id = c.mahalle_id
    WHERE c.id = $1
  `,
  sofor: `
    SELECT
      s.id, s.ad, s.soyad, s.telefon, s.arac_id, s.cavus_id, s.aktif_mi,
      a.plaka, a.arac_turu, a.aktif_mi AS arac_aktif_mi
    FROM soforler s
    LEFT JOIN araclar a ON a.id = s.arac_id
    WHERE s.id = $1
  `,
  sirket: `
    SELECT id, ad, adres, mail, telefon, onay_durumu, aktif_mi
    FROM sirketler
    WHERE id = $1
  `,
};

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

function isAccountEligible(role, account) {
  if (!account?.aktif_mi) return false;
  if (role === "sirket") return account.onay_durumu === "onaylandi";
  if (role === "sofor") return Boolean(account.arac_id && account.arac_aktif_mi);
  return true;
}

function createUser(role, account) {
  const roleData = {
    admin: () => ({
      id: account.id,
      role,
      kullanici_adi: account.kullanici_adi,
      ad_soyad: account.ad_soyad,
      mail: account.mail,
      telefon: account.telefon,
    }),
    cavus: () => ({
      id: account.id,
      role,
      ad_soyad: account.ad_soyad,
      telefon: account.telefon,
      mahalle_id: account.mahalle_id,
      mahalle_ad: account.mahalle_ad,
      ilce: account.ilce,
      il: account.il,
    }),
    sofor: () => ({
      id: account.id,
      role,
      ad: account.ad,
      soyad: account.soyad,
      telefon: account.telefon,
      arac_id: account.arac_id,
      plaka: account.plaka,
      arac_turu: account.arac_turu,
      cavus_id: account.cavus_id,
    }),
    sirket: () => ({
      id: account.id,
      role,
      ad: account.ad,
      adres: account.adres,
      mail: account.mail,
      telefon: account.telefon,
      onay_durumu: account.onay_durumu,
    }),
  };

  return roleData[role]();
}

async function login(identifier, sifre) {
  const normalizedPhone = normalizePhone(identifier);
  const isPhone = /^0\d{10}$/.test(normalizedPhone);
  const lookupValue = isPhone ? normalizedPhone : identifier.trim();
  const query = isPhone ? PHONE_CANDIDATES_QUERY : USERNAME_CANDIDATES_QUERY;
  const result = await pool.query(query, [lookupValue]);
  const candidates = result.rows;

  // Kullanıcı bulunmadığında da bcrypt çalıştırılarak hesap keşfi zorlaştırılır.
  const hashes = candidates.length
    ? candidates.map((candidate) => candidate.sifre)
    : [DUMMY_PASSWORD_HASH];
  const passwordResults = await Promise.all(
    hashes.map((hash) => checkPassword(sifre, hash))
  );
  const matches = candidates.filter((_, index) => passwordResults[index]);

  // Aynı telefon ve parola birden fazla role aitse rol tahmini yapılmaz.
  if (matches.length !== 1) {
    throw createAuthError();
  }

  const candidate = matches[0];
  const accountResult = await pool.query(ACCOUNT_QUERIES[candidate.role], [
    candidate.id,
  ]);
  const account = accountResult.rows[0];

  if (!isAccountEligible(candidate.role, account)) {
    throw createAuthError();
  }

  return {
    token: generateToken({ id: account.id, role: candidate.role }),
    user: createUser(candidate.role, account),
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
  login,
  registerSirket,
};
