# Backend API

Express 5 ve PostgreSQL tabanlı Atık Yönetimi REST API'sidir. Varsayılan port
`5001`, doğrudan sağlık endpoint'i `/health`, proxy üzerinden sağlık endpoint'i
`/api/health`, API taban yolu `/api`'dir.

## Kurulum

```bash
npm ci
copy .env.example .env
npm run migrate
npm run dev
```

Docker PostgreSQL host portu kullanılıyorsa `.env` içindeki `DB_PORT` değeri
`5433`; yerel PostgreSQL kullanılıyorsa ilgili yerel port olmalıdır.
Backend doğrudan çalıştırılırken `TRUST_PROXY_HOPS=0`, Nginx'in arkasındaki
Docker kurulumunda `TRUST_PROXY_HOPS=1` kullanılır.

## Komutlar

- `npm run dev`: nodemon ile geliştirme sunucusu
- `npm start`: migration sonrası üretim sunucusu
- `npm run migrate`: uygulanmamış migration dosyalarını çalıştırır
- `npm run seed`: geliştirme şemasını baştan kurar; mevcut veriyi siler
- `npm run lint`: kaynak ve test statik analizi
- `npm test`: birim testleri
- `npm run test:integration`: çalışan PostgreSQL üzerinde API testleri
- `npm run check`: lint ve birim testleri

## Yanıt ve sayfalama

Başarılı standart yanıt:

```json
{
  "success": true,
  "message": "İşlem başarılı.",
  "data": {}
}
```

Liste endpoint'leri `page` (varsayılan `1`) ve `limit` (varsayılan `50`,
en fazla `200`) kabul eder:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 0,
      "total_pages": 0
    }
  }
}
```

## Kimlik doğrulama

Web istemcisi oturumu `HttpOnly`, `SameSite=Strict` `auth_token` cookie'siyle
taşır. Yazma isteklerinde okunabilir `csrf_token` cookie değeri
`X-CSRF-Token` başlığıyla geri gönderilmelidir. Harici API istemcileri
`Authorization: Bearer <token>` yöntemini de kullanabilir. Roller: `admin`,
`cavus`, `sofor` ve `sirket`. Token imzasının yanı sıra hesabın güncel
veritabanı durumu her istekte kontrol edilir.

Fotoğraf yükleme alanı `fotograflar`, en fazla üç dosya ve dosya başına 5 MB'dir.
Yalnızca gerçek JPEG, PNG ve WEBP içeriği kabul edilir.
