# ADR-001 — Merkezi hesap modeli

Durum: Kabul edildi, kademeli geçiş

## Karar

Kimlik doğrulama için uzun vadeli hedef tek `accounts` tablosu; rol ayrıntıları bire bir bağlı `admin_profiles`, `cavus_profiles`, `sofor_profiles` ve `sirket_profiles` tablolarında tutulacaktır. Geçiş sırasında mevcut API sözleşmesi değiştirilmeyecektir.

İlk güvenli adım olarak `account_identifiers` kayıt defteri eklenmiştir. Çavuş, şoför ve şirket tablolarındaki telefonlar trigger ile bu tabloda merkezî ve tekil tutulur. Böylece aynı telefonun farklı rol tablolarında yeniden kullanılması veritabanı seviyesinde engellenir.

## Kademeli geçiş

1. Yeni hesapların merkezî kimliğini oluştur, eski tablo kimliklerini eşleme tablosunda tut.
2. Login okumasını iki model üzerinde gölge karşılaştırmayla doğrula.
3. Profil yazmalarını transaction içinde iki modele yaz.
4. Tutarlılık raporu sıfır hataya ulaştığında login’i `accounts` üzerine geçir.
5. Eski parola alanlarını kaldır; profil tablolarında yalnızca role özgü verileri bırak.

Bu yol, sahadaki oturumları ve mevcut yabancı anahtarları tek seferde kıran riskli bir dönüşümü önler.
