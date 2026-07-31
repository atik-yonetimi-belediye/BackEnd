# ADR-002 — Sayfalama ve fotoğraf depolama

Durum: Kabul edildi

## Sayfalama

Yönetim tablolarının mevcut toplam sayfa göstergesi için offset sayfalama korunur. Saha geçmişi ve audit kayıtları gibi sürekli büyüyen, tarihe göre sıralı akışlarda yeni endpointler `(created_at, id)` bileşik cursor kullanacaktır. Cursor imzalı/base64url bir değer olacak; sorgu `WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT $3` biçiminde çalışacaktır.

Frontend artık tek istekte `limit: 200` kullanmaz; küçük, sınırlandırılmış sayfaları iptal edilebilir isteklerle alır. Cursor geçişi geriye uyumluluk için yeni API sürümünde yapılacaktır.

## Fotoğraf depolama

Yerel geliştirmede disk depolama desteklenir. `S3_ENDPOINT`, `S3_BUCKET` ve `S3_PUBLIC_BASE_URL` birlikte tanımlandığında şikâyet fotoğrafları S3 uyumlu depoya yazılır; veritabanında nesnenin URL’si tutulur ve şikâyet arşivlendiğinde nesne de silinir. Eksik/kısmi S3 yapılandırması fail-closed davranır.
