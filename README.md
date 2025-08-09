## Morphine

Modern, extensible, Bun + Elysia tabanlı bir API iskeleti. JWT ile kimlik doğrulama, MySQL veritabanı, hız sınırlandırma, Swagger dokümantasyonu ve dinamik yüklenen eklenti (extension) mimarisi içerir.

### İçindekiler

- [Özellikler](#özellikler)
- [Teknolojiler](#teknolojiler)
- [Proje Yapısı](#proje-yapısı)
- [Kurulum](#kurulum)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Veritabanı Şeması](#veritabanı-şeması)
- [Çalıştırma](#çalıştırma)
- [API Referansı](#api-referansı)
- [Eklenti (Extension) Sistemi](#eklenti-extension-sistemi)
- [Hata Yönetimi ve Oran Sınırlama](#hata-yönetimi-ve-oran-sınırlama)
- [Geliştirme Notları](#geliştirme-notları)

### Özellikler

- **JWT tabanlı kimlik doğrulama**: Kayıt ve giriş uç noktaları ile token üretimi.
- **MySQL bağlantı havuzu**: `mysql2/promise` ile verimli sorgular ve `Database` yardımcı sınıfı.
- **Swagger ile otomatik API dokümantasyonu**: Kolay keşif ve test için.
- **Oran sınırlama (rate limit)**: Varsayılan olarak 10 dakikada 100 istek.
- **Eklenti mimarisi**: `EXTENSION_DIR` altındaki her klasör, `manifest.json` ile otomatik yüklenir.

### Teknolojiler

- **Bun** (v1.2.18+)
- **Elysia** (HTTP framework)
- **@elysiajs/jwt**, **@elysiajs/swagger**, **elysia-rate-limit**
- **MySQL (mysql2)**
- **bcrypt** (parola hashleme)
- **dotenv**, **chalk**

### Proje Yapısı

```
morphine/
  backend/
    src/
      Controllers/
        Home.ts                  # Root controller ("/")
        api/
          api.ts                # /api ana router
          User.ts               # /api/user/auth -> login/register
      Lib/
        Database.ts             # MySQL havuzu ve sorgu yardımcıları
        Extension.ts            # Eklenti yükleyici ve yardımcılar
        User.ts                 # Kullanıcı veri erişim katmanı
      index.ts                  # Uygulama giriş noktası (Elysia, Swagger, RateLimit, Extensions)
    extensions/
      Test/
        manifest.json           # Eklenti bildirimi (index dosyası yolu)
        index.ts                # Eklentinin init noktası
        types.ts                # Eklenti tarafı tipler
    public/
      index.html                # Statik içerik (şu an devre dışı)
    types/types.ts              # Paylaşılan tipler (User, Manifest, ExtensionUtils)
    package.json
    tsconfig.json
```

### Kurulum

1. **Önkoşullar**

   - Bun v1.2.18+ (`bun --version`)
   - MySQL 8+ (erişim bilgileri hazır olmalı)

2. **Bağımlılıkların kurulumu**

   ```bash
   cd backend
   bun install
   ```

3. **.env dosyası** (örnek aşağıda; değerleri kendi ortamınıza göre güncelleyin)

   ```ini
   # Sunucu
   JWT_SECRET=change-me
   BCRYPT_SALT_ROUND=10

   # MySQL
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASS=your_password
   DB_NAME=morphine

   # Eklentiler
   EXTENSION_DIR=E:/ws/morphine/backend/extensions
   ```

### Ortam Değişkenleri

- **JWT_SECRET**: JWT imzalama anahtarı.
- **BCRYPT_SALT_ROUND**: Bcrypt salt tur sayısı (örn. 10-12).
- **DB_HOST / DB_PORT / DB_USER / DB_PASS / DB_NAME**: MySQL bağlantı bilgileri.
- **EXTENSION_DIR**: Eklentilerin kök klasörü. Her alt klasör bir eklenti olarak yüklenir.

### Veritabanı Şeması

Uygulama en az iki tablo bekliyor: `users` ve `errors`.

```sql
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(32) NOT NULL UNIQUE,
  email VARCHAR(64) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS errors (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  stack TEXT NULL,
  message TEXT NULL,
  name VARCHAR(255) NULL,
  cause TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);
```

Parolalar, `BCRYPT_SALT_ROUND` değeriyle `bcrypt` kullanılarak hash'lenir.

### Çalıştırma

- Geliştirme modu (watch):
  ```bash
  cd backend
  bun run dev
  ```
- Varsayılan port: **3000**. Sunucu açıldığında: `Server started on port 3000`.

### API Referansı

- **Base URL**: `http://localhost:3000`
- **Swagger Dokümantasyonu**: `http://localhost:3000/swagger`
- **Rate Limit**: 10 dakikada 100 istek.

#### Kimlik Doğrulama

- **POST** `/api/user/auth/register`

  - Body:
    ```json
    {
      "username": "min8max32",
      "password": "min8max128",
      "email": "user@example.com"
    }
    ```
  - 200 Response:
    ```json
    { "token": "<jwt>", "success": true }
    ```
  - 409 Response:
    ```json
    { "success": false }
    ```

- **POST** `/api/user/auth/login`
  - Body:
    ```json
    { "username": "kullaniciadi", "password": "parola" }
    ```
  - 200 Response:
    ```json
    { "token": "<jwt>", "success": true }
    ```
  - 401 Response (kullanıcı yok veya parola hatalı):
    ```json
    { "success": false, "message": "Invalid password" }
    ```

Örnek `curl`:

```bash
curl -X POST http://localhost:3000/api/user/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"exampleuser","password":"examplepass","email":"user@example.com"}'

curl -X POST http://localhost:3000/api/user/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"exampleuser","password":"examplepass"}'
```

### Eklenti (Extension) Sistemi

- Uygulama açılışında `EXTENSION_DIR` altındaki her klasörü dolaşır.
- Her klasörde bir `manifest.json` aranır ve buradaki `index` alanı ile eklentinin giriş dosyası yüklenir.
- Eklenti modülü, `init(utils: ExtensionUtils)` fonksiyonunu dışa aktarmalıdır.
- `utils.app`, `/extensions` öneki ile isimlendirilmiş bir Elysia uygulamasıdır. Eklentiniz bu `app` üzerinden route tanımlar.

Örnek `manifest.json`:

```json
{
  "version": "0.0.1",
  "author": "You",
  "index": "index.ts"
}
```

Örnek `index.ts`:

```ts
import type { ExtensionUtils } from "../../types/types"; // veya eklentinizin kendi tip yolu

export const init = (utils: ExtensionUtils) => {
  utils.log("My extension loaded");
  utils.app.get("/hello", () => ({ message: "Hello from extension" }));
};
```

Eğer yukarıdaki gibi bir rota tanımlarsanız, istek yolu: `GET /extensions/hello` olur.

Repo içindeki örnek eklenti (`backend/extensions/Test`) varsayılan olarak `GET /extensions/` yoluna "Hello Elysia" döner.

### Hata Yönetimi ve Oran Sınırlama

- **Hatalar**: Yakalanmayan hatalar `errors` tablosuna kaydedilir (`stack`, `message`, `name`, `cause`).
- **Rate Limit**: 10 dakika penceresinde max 100 istek.

### Geliştirme Notları

- Statik dosya servisi (`@elysiajs/static`) hazır, ancak şu an devre dışı. `backend/src/index.ts` içinde ilgili satırları açarak aktif edebilirsiniz.
- TypeScript ayarları `bundler` modunda ve `strict` açıktır.
- Kodda paylaşılan tipler `backend/types/types.ts` içinde tutulur.

---

Sorun/öneri için lütfen bir konu (issue) açın veya doğrudan katkıda bulunun. İyi çalışmalar!
