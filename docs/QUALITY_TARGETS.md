# Backend kalite hedefleri

- Sağlık endpoint'i kullanılabilirliği: en az %99,9
- Okuma endpoint'leri p95: normal yükte en fazla 300 ms
- Yazma endpoint'leri p95: normal yükte en fazla 700 ms
- Beklenmeyen HTTP 5xx oranı: %0,5'in altında
- Kritik ve yüksek uygulanabilir production bağımlılık bulgusu: 0
- Unit ve integration test başarı oranı: %100

Bu değerler yerel geliştirme süreleri değil, staging ve production ölçümleri için
hedeflerdir. Faz 5 yük testleri ve Faz 6 izleme sistemi bu hedefleri otomatik
olarak doğrulayacaktır.
