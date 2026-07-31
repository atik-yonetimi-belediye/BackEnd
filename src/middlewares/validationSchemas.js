const { z } = require("zod");
const { normalizePhone } = require("../utils/phone");

const ATIK_TURLERI = ["kati_atik", "geri_donusum"];
const TOPLAMA_DURUMLARI = ["toplandi", "atlanildi"];
const SIKAYET_DURUMLARI = [
  "bekliyor",
  "inceleniyor",
  "cozuldu",
  "reddedildi",
];
const SIKAYET_KATEGORILERI = [
  "konteyner_dolu",
  "konteyner_kirik",
  "kotu_koku",
  "cop_tasmasi",
  "zamaninda_toplanmadi",
  "diger",
];
const TALEP_DURUMLARI = [
  "bekliyor",
  "onaylandi",
  "reddedildi",
  "tamamlandi",
  "iptal_edildi",
];
const SIRKET_ONAY_DURUMLARI = [
  "bekliyor",
  "onaylandi",
  "reddedildi",
  "pasif",
];

const emptyToUndefined = (value) =>
  value === "" || value === null ? undefined : value;

const trimmedString = (min, max, fieldName) =>
  z
    .string({ error: `${fieldName} metin olmalıdır.` })
    .trim()
    .min(min, `${fieldName} en az ${min} karakter olmalıdır.`)
    .max(max, `${fieldName} en fazla ${max} karakter olabilir.`);

const optionalString = (max) =>
  z.preprocess(
    emptyToUndefined,
    z.string().trim().max(max).optional()
  );

const clearableString = (max) =>
  z.union([z.string().trim().max(max), z.null()]).optional();

const id = z.coerce
  .number({ error: "ID sayısal olmalıdır." })
  .int("ID tam sayı olmalıdır.")
  .positive("ID pozitif olmalıdır.");

const idParams = z.object({ id });

const phone = z
  .string()
  .transform(normalizePhone)
  .refine(
    (value) => /^0\d{10}$/.test(value),
    "Telefon 0 ile başlayan 11 haneli bir numara olmalıdır."
  );

const email = z
  .string()
  .trim()
  .email("Geçerli bir e-posta adresi girilmelidir.")
  .max(100)
  .transform((value) => value.toLowerCase());

const password = z
  .string()
  .min(8, "Şifre en az 8 karakter olmalıdır.")
  .max(128, "Şifre en fazla 128 karakter olabilir.");

const loginPassword = z.string().min(1).max(128);

const booleanQuery = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
};

const paginationQuery = z.object(paginationShape);

const auth = {
  adminLogin: z.object({
    kullanici_adi: trimmedString(2, 50, "Kullanıcı adı"),
    sifre: loginPassword,
  }),
  phoneLogin: z.object({
    telefon: phone,
    sifre: loginPassword,
  }),
  sirketLogin: z.object({
    mail: email,
    sifre: loginPassword,
  }),
  sirketRegister: z.object({
    ad: trimmedString(2, 150, "Şirket adı"),
    adres: optionalString(1000),
    mail: email,
    telefon: phone,
    sifre: password,
  }),
};

const mahalle = {
  listQuery: paginationQuery,
  idParams,
};

const konteyner = {
  listQuery: z.object({
    tur: z.enum(ATIK_TURLERI).optional(),
    mahalle_id: id.optional(),
    aktif_mi: booleanQuery.optional(),
    ...paginationShape,
  }),
  idParams,
};

const personName = trimmedString(2, 50, "Ad").regex(
  /^[a-zA-ZçÇğĞıİöÖşŞüÜ\s'-]+$/,
  "Ad yalnızca harf, boşluk, kesme ve tire içerebilir."
);

const plate = trimmedString(5, 20, "Plaka")
  .transform((value) => value.toLocaleUpperCase("tr-TR"))
  .refine(
    (value) => /^\d{2}\s[A-ZÇĞİÖŞÜ]{1,4}\s\d{2,4}$/.test(value),
    "Plaka '46 ABC 123' biçiminde olmalıdır."
  );

const cavus = {
  createKonteyner: z.object({
    konteyner_kodu: trimmedString(2, 50, "Konteyner kodu")
      .transform((value) => value.toLocaleUpperCase("tr-TR"))
      .optional(),
    tur: z.enum(ATIK_TURLERI),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
  }),
  createArac: z.object({
    plaka: plate,
    arac_turu: z.enum(ATIK_TURLERI),
  }),
  updateArac: z
    .object({
      plaka: plate.optional(),
      arac_turu: z.enum(ATIK_TURLERI).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "En az bir güncelleme alanı gönderilmelidir.",
    }),
  createSofor: z.object({
    ad: personName,
    soyad: personName,
    telefon: phone,
    sifre: password,
    arac_id: id,
  }),
  updateSoforArac: z.object({ arac_id: id }),
  idParams,
  listQuery: paginationQuery,
};

const sofor = {
  createToplamaKaydi: z
    .object({
      konteyner_id: id,
      durum: z.enum(TOPLAMA_DURUMLARI),
      sebep: optionalString(255),
      diger_aciklama: optionalString(2000),
    })
    .superRefine((value, context) => {
      if (value.durum === "atlanildi" && !value.sebep) {
        context.addIssue({
          code: "custom",
          path: ["sebep"],
          message: "Atlanan konteyner için sebep zorunludur.",
        });
      }
      if (
        value.durum === "toplandi" &&
        (value.sebep || value.diger_aciklama)
      ) {
        context.addIssue({
          code: "custom",
          path: ["sebep"],
          message: "Toplandı durumunda sebep/açıklama gönderilemez.",
        });
      }
      if (
        value.durum === "atlanildi" &&
        value.sebep === "Diğer" &&
        !value.diger_aciklama
      ) {
        context.addIssue({
          code: "custom",
          path: ["diger_aciklama"],
          message: "Diğer sebebi için açıklama zorunludur.",
        });
      }
    }),
  listQuery: paginationQuery,
};

const sikayet = {
  create: z.object({
    vatandas_ad_soyad: trimmedString(3, 100, "Ad soyad"),
    vatandas_telefon: phone,
    konteyner_id: id,
    sikayet_turu: z.enum(ATIK_TURLERI),
    sikayet_kategorisi: z.enum(SIKAYET_KATEGORILERI).default("diger"),
    sikayet_metni: trimmedString(5, 3000, "Şikâyet metni"),
  }),
  listQuery: z.object({
    durum: z.enum(SIKAYET_DURUMLARI).optional(),
    sikayet_turu: z.enum(ATIK_TURLERI).optional(),
    sikayet_kategorisi: z.enum(SIKAYET_KATEGORILERI).optional(),
    konteyner_id: id.optional(),
    ...paginationShape,
  }),
  updateDurum: z.object({
    durum: z.enum(SIKAYET_DURUMLARI),
    yonetici_notu: optionalString(3000),
  }),
  idParams,
};

const sirketTalepFields = {
  konteyner_id: z.preprocess(emptyToUndefined, id.optional()),
  talep_basligi: optionalString(150),
  talep_aciklamasi: optionalString(3000),
  tahmini_miktar: z.preprocess(
    emptyToUndefined,
    z.coerce.number().positive("Tahmini miktar pozitif olmalıdır.").max(1000000).optional()
  ),
  adres: optionalString(1000),
};

const requireTalepContent = (schema) =>
  schema.refine(
    (value) => value.talep_basligi || value.talep_aciklamasi,
    {
      message: "Talep başlığı veya açıklamasından en az biri zorunludur.",
      path: ["talep_basligi"],
    }
  );

const sirket = {
  createTalep: requireTalepContent(z.object(sirketTalepFields)),
  updateTalep: z
    .object({
      talep_basligi: clearableString(150),
      talep_aciklamasi: clearableString(3000),
      tahmini_miktar: sirketTalepFields.tahmini_miktar,
      adres: clearableString(1000),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "En az bir güncelleme alanı gönderilmelidir.",
    }),
  listQuery: paginationQuery,
  idParams,
};

const recycling = {
  listQuery: z.object({
    durum: z.enum(TALEP_DURUMLARI).optional(),
    gonderen_tipi: z.enum(["vatandas", "yonetici", "sirket"]).optional(),
    sirket_id: id.optional(),
    konteyner_id: id.optional(),
    ...paginationShape,
  }),
  updateDurum: z.object({
    durum: z.enum(TALEP_DURUMLARI),
    yonetici_notu: optionalString(3000),
  }),
  idParams,
};

const admin = {
  sirketListQuery: z.object({
    onay_durumu: z.enum(SIRKET_ONAY_DURUMLARI).optional(),
    aktif_mi: booleanQuery.optional(),
    ...paginationShape,
  }),
  updateSirketOnay: z.object({
    onay_durumu: z.enum(SIRKET_ONAY_DURUMLARI),
  }),
  konteynerListQuery: konteyner.listQuery,
  aracListQuery: z.object({
    arac_turu: z.enum(ATIK_TURLERI).optional(),
    cavus_id: id.optional(),
    aktif_mi: booleanQuery.optional(),
    ...paginationShape,
  }),
  toplamaListQuery: z
    .object({
      durum: z.enum(TOPLAMA_DURUMLARI).optional(),
      sofor_id: id.optional(),
      konteyner_id: id.optional(),
      mahalle_id: id.optional(),
      date_from: z.iso.date().optional(),
      date_to: z.iso.date().optional(),
      ...paginationShape,
    })
    .refine(
      (value) =>
        !value.date_from ||
        !value.date_to ||
        value.date_from <= value.date_to,
      {
        message: "Başlangıç tarihi bitiş tarihinden sonra olamaz.",
        path: ["date_from"],
      }
    ),
  listQuery: paginationQuery,
  idParams,
};

module.exports = {
  auth,
  mahalle,
  konteyner,
  cavus,
  sofor,
  sikayet,
  sirket,
  recycling,
  admin,
  constants: {
    ATIK_TURLERI,
    TOPLAMA_DURUMLARI,
    SIKAYET_DURUMLARI,
    SIKAYET_KATEGORILERI,
    TALEP_DURUMLARI,
    SIRKET_ONAY_DURUMLARI,
  },
};
