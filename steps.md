## E-ticaret Uygulaması Yol Haritası (Steps)

Durum işaretleri: [x] yapıldı, [ ] yapılmadı, [~] kısmen

### 1) Çekirdek Altyapı

- [x] REST API framework (Elysia + Bun)
- [x] Swagger dokümantasyonu (/swagger, /swagger/json)
- [x] Oran sınırlama (rate limit)
- [x] Eklenti (extension) mimarisi + sandbox (node:vm + Bun.Transpiler)
- [x] Ortam değişkenleri ve yapılandırma (dotenv)
- [~] Statik dosya servisi (hazır eklentilerde kullanılabilir, çekirdekte kapalı)
- [x] Hata kaydı (DB `errors` tablosu + Logger)

### 2) Kimlik Doğrulama ve Kullanıcılar

- [x] Kayıt / Giriş (Users eklentisi altında JWT)
- [x] Basit arama ve katalog geliştirmeleri (Products eklentisinde q/sort/paging)
- [x] Kategoriler eklentisi ile ağaç ve i18n
- [x] Şifre sıfırlama/hatırlatma akışı (Auth eklentisi: /auth/password/reset/\*)
- [x] E-posta doğrulama akışı (Auth eklentisi: /auth/verify-email/\*)
- [ ] 2FA (TOTP/SMS) desteği
- [ ] RBAC (role-based access control) ve izinler

### 3) Katalog ve Ürün Yönetimi

- [x] Ürün CRUD (Products eklentisi)
- [x] Ürün türleri: tek seferlik ve abonelik
- [x] Ürün çevirileri (i18n: `products_i18n`, locale bazlı okuma)
- [x] Kategoriler ve ağaç yapısı (Categories eklentisi + i18n)
- [ ] Ürün görselleri (upload, depolama, CDN)
- [ ] Varyantlar/opsiyonlar (renk, beden vb.)
- [ ] Envanter/stok takibi (rezervasyon, düşük stok uyarıları)
- [x] Arama/filtreleme/sıralama/sayfalama (Products: q, sort, paging; i18n destekli)

### 4) Sepet ve Ödeme Süreci

- [ ] Sepet (cart) CRUD, kupon ve kargo bedelleriyle toplam hesaplama
- [ ] Misafir sepeti ve kullanıcıya bağlama
- [ ] Checkout akışı (adres, kargo, ödeme adımları)
- [ ] Ödeme sağlayıcı entegrasyonları (Stripe/IyziPay/PayTR vb.)
- [ ] Tek seferlik ödeme ve abonelik tahsilatı desteği
- [ ] 3D Secure / iyzico 3DS akışı (varsa)

### 5) Sipariş ve Faturalandırma

- [ ] Sipariş şeması ve durum makinesi (created/paid/shipped/refunded/canceled)
- [ ] Fatura oluşturma (PDF), e-fatura/e-arşiv entegrasyonu (opsiyonel)
- [ ] İade/iptal ve geri ödeme akışları
- [ ] Teslimat/kargo şirketi entegrasyonları ve takip numarası

### 6) Fiyatlandırma ve Kampanyalar

- [ ] Kupon/kod, hediye çeki
- [ ] Kampanyalar: yüzde/indirim, 2 al 1 öde, sepet toplamı bazlı indirim
- [ ] Vergi kuralları (KDV/ÖTV), coğrafi bazlı vergi hesaplama
- [ ] Çoklu para birimi, dinamik kur çevirisi

### 7) İçerik, SEO ve Uluslararasılaştırma

- [ ] CMS sayfaları (Hakkında, KVKK, İade Koşulları vb.)
- [ ] Blog/duyuru (opsiyonel)
- [ ] SEO meta etiketleri, og-tags, sitemap.xml, robots.txt
- [~] Uluslararasılaştırma: ürün çevirileri mevcut; diğer alanlar (kategori, sayfa vb.) beklemede

### 8) Müşteri Deneyimi

- [ ] Yorum ve puanlama (review & rating)
- [ ] Favoriler/istek listesi (wishlist)
- [ ] Bildirimler/e-postalar (sipariş durumu, karşılama, şifre sıfırlama)
- [ ] Canlı destek/soa (opsiyonel)

### 9) Yönetim Paneli (Admin)

- [ ] Ürün/çeviri yönetimi arayüzü
- [ ] Sipariş, stok, müşteriler, kuponlar yönetimi
- [ ] Rol/izin yönetimi
- [ ] Audit log (kritik işlemler için)

### 10) Güvenlik ve Uyumluluk

- [x] Oran sınırlama (API kötüye kullanımına karşı)
- [ ] Güvenlik başlıkları (helmet eşleniği) ve CORS politikası
- [ ] Parola politikaları, brute-force koruması
- [ ] GDPR/KVKK süreçleri (veri ihracı/silme, aydınlatma metinleri)
- [ ] Cookie banner/consent yönetimi (web arayüzü için)

### 11) Gözlemlenebilirlik ve Operasyon

- [x] Hata günlüğü DB kaydı (`errors`)
- [ ] Yapılandırılabilir seviyeli loglama (JSON log, pipeline)
- [ ] Metrikler (Prometheus/OpenTelemetry)
- [ ] Healthcheck/probe endpoint’leri
- [ ] Uyarılar (Slack/Email/Webhook) ve olay kaydı

### 12) Performans ve Ölçeklenebilirlik

- [ ] Caching (HTTP cache, Redis, ETag/If-None-Match)
- [ ] N+1 sorguların önlenmesi, index’ler
- [ ] CDN entegrasyonu (görseller, statik dosyalar)
- [ ] Kuyruk/arka plan işler (sipariş e-postaları, fatura işleme)

### 13) Geliştirici Deneyimi ve Altyapı

- [ ] SQL migration aracı (ör. drizzle/knex/prisma migrate)
- [ ] Seed verileri (demo ürünler, kullanıcılar)
- [ ] CI/CD (lint, test, build, deploy pipeline)
- [ ] Containerize (Dockerfile, docker-compose), staging/prod ortamları
- [ ] Gizli anahtar yönetimi (dotenv yerine secrets manager)

### 14) Testler ve Kalite

- [ ] Birim testleri (iş mantığı)
- [ ] Entegrasyon testleri (DB + API uçları)
- [ ] Yük/performans testleri
- [ ] Güvenlik testleri (OWASP yönelimli)

---

### Şu anki durum (özet)

- [x] JWT kimlik doğrulama (Users eklentisi)
- [x] Ürün CRUD + abonelik/tek seferlik tipleri (Products eklentisi)
- [x] Ürün i18n (okuma ve create/update’te çeviri ekleme)
- [x] Swagger dokümantasyonu (katalog ve auth uçları şemalı)
- [x] Hata kayıtları veritabanında
- [x] Eklenti mimarisi (sandbox + izinler, Elysia ile uyumlu)

Eksikler: sepet/checkout/ödeme/sipariş/kupon/vergi/kargo ve admin arayüzü başta olmak üzere işletme akışları; ayrıca migration/seed, test/CI, güvenlik ve performans katmanları.

### Önerilen sıradaki adımlar

1. Migration/seed altyapısı ([ ]) ve index düzenlemeleri ([ ])
2. Ürün görselleri/yükleme ve varyantlar ([ ])
3. Sepet ve checkout akışı (adres, kargo, vergi, kupon) ([ ])
4. Ödeme sağlayıcı entegrasyonu (Stripe veya yerel sağlayıcı) ([ ])
5. Sipariş şeması ve durum yönetimi ([ ])
6. Admin panel (ürünler/siparişler/kullanıcılar/roller) ([ ])
7. E-posta bildirimleri ve şablonlar ([ ])
8. CI/CD ve test stratejisi ([ ])
