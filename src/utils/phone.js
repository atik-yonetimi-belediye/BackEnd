function normalizePhone(phone) {
  if (!phone) return phone;

  let cleaned = String(phone).replace(/\D/g, "");

  if (cleaned.startsWith("0090")) cleaned = cleaned.slice(4);
  else if (cleaned.startsWith("90") && cleaned.length === 12) cleaned = cleaned.slice(2);

  // Kullanıcı 543... veya 0543... girebilir; veritabanında tek biçim kullanılır.
  if (cleaned.length === 10 && cleaned.startsWith("5")) cleaned = `0${cleaned}`;

  return cleaned;
}

module.exports = {
  normalizePhone,
};
