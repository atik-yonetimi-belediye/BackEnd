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
const GOREV_DURUMLARI = ["atandi", "devam_ediyor", "tamamlandi", "atlandi", "iptal_edildi"];
const GOREV_ONCELIKLERI = ["dusuk", "normal", "yuksek", "acil"];
const PERSONEL_TURLERI = ["cavus", "sofor"];

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
  login: z
    .object({
      identifier: trimmedString(2, 100, "Telefon numarası veya kullanıcı adı"),
      sifre: loginPassword,
    })
    .strict(),
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
  /^[\p{L}\s'-]+$/u,
  "Ad yalnızca harf, boşluk, kesme ve tire içerebilir."
);

const fullPersonName = trimmedString(2, 100, "Ad soyad").regex(
  /^[\p{L}\s'-]+$/u,
  "Ad soyad yalnızca harf, boşluk, kesme ve tire içerebilir."
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
  updateKonteyner: z.object({
    tur: z.enum(ATIK_TURLERI).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    adres: clearableString(1000),
    yerlesim_notu: clearableString(2000),
  }).refine((value) => Object.keys(value).length > 0, { message: "En az bir güncelleme alanı gönderilmelidir." }),
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
  updateSofor: z.object({ ad: personName.optional(), soyad: personName.optional(), telefon: phone.optional() })
    .refine((value) => Object.keys(value).length > 0, { message: "En az bir güncelleme alanı gönderilmelidir." }),
  updateSoforArac: z.object({ arac_id: id }),
  createKonteynerGorevi: z.object({
    sofor_id: id,
    oncelik: z.enum(GOREV_ONCELIKLERI).optional().default("normal"),
    hedef_tarih: z.union([z.iso.datetime({ offset: true }), z.null()]).optional().default(null),
    yonetici_notu: optionalString(2000),
  }),
  cancelKonteynerGorevi: z.object({ iptal_nedeni: optionalString(1000) }),
  bulkKonteynerGorevi: z.object({
    konteyner_ids: z.array(id).min(1).max(100).transform((items) => [...new Set(items)]),
    sofor_id: id,
    oncelik: z.enum(GOREV_ONCELIKLERI).optional().default("normal"),
    hedef_tarih: z.union([z.iso.datetime({ offset: true }), z.null()]).optional().default(null),
    yonetici_notu: optionalString(2000),
  }),
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
      latitude: z.preprocess(emptyToUndefined, z.coerce.number().min(-90).max(90).optional()),
      longitude: z.preprocess(emptyToUndefined, z.coerce.number().min(-180).max(180).optional()),
      konum_dogruluk_metre: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(100000).optional()),
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
      if ((value.latitude === undefined) !== (value.longitude === undefined)) {
        context.addIssue({
          code: "custom",
          path: ["latitude"],
          message: "Konum kaydı için enlem ve boylam birlikte gönderilmelidir.",
        });
      }
    }),
  listQuery: paginationQuery,
  gorevListQuery: z.object({
    durum: z.enum(GOREV_DURUMLARI).optional(),
    ...paginationShape,
  }),
  gorevIdParams: idParams,
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
      konteyner_id: z.union([id, z.null()]).optional(),
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
  personelYetkiParams: z.object({ accountType: z.enum(PERSONEL_TURLERI), id }),
  updatePersonelYetkileri: z.object({
    permissions: z.array(z.object({
      code: trimmedString(2, 100, "Yetki kodu"),
      allowed: z.union([z.boolean(), z.null()]),
    })).min(1).max(100),
  }),
  cavusListQuery: z.object({
    search: optionalString(100),
    aktif_mi: booleanQuery.optional(),
    mahalle_id: id.optional(),
    ...paginationShape,
  }),
  soforListQuery: z.object({
    search: optionalString(100),
    aktif_mi: booleanQuery.optional(),
    cavus_id: id.optional(),
    arac_id: id.optional(),
    ...paginationShape,
  }),
  createCavus: z.object({
    ad_soyad: fullPersonName,
    telefon: phone,
    sifre: password,
    mahalle_id: id,
    aktif_mi: z.boolean().optional().default(true),
  }),
  updateCavus: z
    .object({
      ad_soyad: fullPersonName.optional(),
      telefon: phone.optional(),
      mahalle_id: id.optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "En az bir güncelleme alanı gönderilmelidir.",
    }),
  createSofor: z.object({
    ad: personName,
    soyad: personName,
    telefon: phone,
    sifre: password,
    cavus_id: id,
    arac_id: id,
    aktif_mi: z.boolean().optional().default(true),
  }),
  updateSofor: z
    .object({
      ad: personName.optional(),
      soyad: personName.optional(),
      telefon: phone.optional(),
      cavus_id: id.optional(),
      arac_id: z.union([id, z.null()]).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "En az bir güncelleme alanı gönderilmelidir.",
    }),
  updatePersonelDurum: z.object({ aktif_mi: z.boolean() }),
  resetPersonelPassword: z.object({ sifre: password }),
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
    search: optionalString(100),
    arac_turu: z.enum(ATIK_TURLERI).optional(),
    cavus_id: id.optional(),
    aktif_mi: booleanQuery.optional(),
    atama_durumu: z.enum(["atanmis", "bosta"]).optional(),
    ...paginationShape,
  }),
  createArac: z.object({
    plaka: plate,
    arac_turu: z.enum(ATIK_TURLERI),
    cavus_id: id,
    aktif_mi: z.boolean().optional().default(true),
  }),
  updateArac: z
    .object({
      plaka: plate.optional(),
      arac_turu: z.enum(ATIK_TURLERI).optional(),
      cavus_id: id.optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "En az bir güncelleme alanı gönderilmelidir.",
    }),
  updateAracDurum: z.object({ aktif_mi: z.boolean() }),
  updateAracAtama: z.object({
    cavus_id: id,
    sofor_id: z.union([id, z.null()]).optional().default(null),
  }),
  gorevListQuery: z.object({
    durum: z.enum(GOREV_DURUMLARI).optional(),
    ...paginationShape,
  }),
  createKonteynerGorevi: z.object({
    cavus_id: id,
    sofor_id: id,
    oncelik: z.enum(GOREV_ONCELIKLERI).optional().default("normal"),
    hedef_tarih: z.union([z.iso.datetime({ offset: true }), z.null()]).optional().default(null),
    yonetici_notu: optionalString(2000),
    farkli_mahalle_onayi: z.boolean().optional().default(false),
  }),
  bulkKonteynerGorevi: z.object({
    konteyner_ids: z.array(id).min(1).max(100).transform((items) => [...new Set(items)]),
    cavus_id: id,
    sofor_id: id,
    oncelik: z.enum(GOREV_ONCELIKLERI).optional().default("normal"),
    hedef_tarih: z.union([z.iso.datetime({ offset: true }), z.null()]).optional().default(null),
    yonetici_notu: optionalString(2000),
    farkli_mahalle_onayi: z.boolean().optional().default(false),
  }),
  createKonteyner: z.object({
    konteyner_kodu: trimmedString(2, 50, "Konteyner kodu").transform((value) => value.toLocaleUpperCase("tr-TR")).optional(),
    tur: z.enum(ATIK_TURLERI),
    mahalle_id: id,
    cavus_id: z.union([id, z.null()]).optional().default(null),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    adres: optionalString(1000),
    kapasite_litre: z.preprocess(emptyToUndefined, z.coerce.number().int().min(30).max(10000).optional()),
    yerlesim_notu: optionalString(2000),
    kurulum_tarihi: z.preprocess(emptyToUndefined, z.iso.date().optional()),
    aktif_mi: z.boolean().optional().default(true),
    yakin_konteyner_onayi: z.boolean().optional().default(false),
  }),
  updateKonteyner: z.object({
    konteyner_kodu: trimmedString(2, 50, "Konteyner kodu").transform((value) => value.toLocaleUpperCase("tr-TR")).optional(),
    tur: z.enum(ATIK_TURLERI).optional(),
    mahalle_id: id.optional(),
    cavus_id: z.union([id, z.null()]).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    adres: clearableString(1000),
    kapasite_litre: z.union([z.coerce.number().int().min(30).max(10000), z.null()]).optional(),
    yerlesim_notu: clearableString(2000),
    kurulum_tarihi: z.union([z.iso.date(), z.null()]).optional(),
    farkli_mahalle_onayi: z.boolean().optional().default(false),
  }).refine((value) => Object.keys(value).some((key) => key !== "farkli_mahalle_onayi"), {
    message: "En az bir güncelleme alanı gönderilmelidir.",
  }),
  updateKonteynerDurum: z.object({ aktif_mi: z.boolean() }),
  konteynerQrQuery: z.object({ target: z.url().max(2000).refine((value) => /^https?:\/\//i.test(value), "QR hedefi http veya https olmalıdır.") }),
  updateKonteynerCavus: z.object({
    cavus_id: id,
    acik_gorevi_iptal_et: z.boolean().optional().default(false),
    farkli_mahalle_onayi: z.boolean().optional().default(false),
  }),
  updateKonteynerGorevi: z
    .object({
      oncelik: z.enum(GOREV_ONCELIKLERI).optional(),
      hedef_tarih: z.union([z.iso.datetime({ offset: true }), z.null()]).optional(),
      yonetici_notu: clearableString(2000),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "En az bir güncelleme alanı gönderilmelidir.",
    }),
  cancelKonteynerGorevi: z.object({
    iptal_nedeni: optionalString(1000),
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
    GOREV_DURUMLARI,
    GOREV_ONCELIKLERI,
  },
};
