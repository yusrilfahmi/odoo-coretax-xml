# Odoo 19 Online to Coretax XML Exporter

Modul integrasi backend berbasis Node.js (Express) untuk mengonversi data **Customer Invoice Odoo 19 Online** menjadi file XML berformat **TaxInvoiceBulk** yang siap diimpor ke aplikasi **Coretax DJP**.

---

## 🌟 Fitur Utama

- **Direct 1-Click Download**: Pengguna mengklik tombol "Download XML Coretax" di Odoo Studio, dan browser langsung mengunduh file XML tanpa jeda.
- **Kepatuhan Struktur XML Coretax**:
  - Root element `<TaxInvoiceBulk>` mengacu pada `TaxInvoice.xsd`.
  - Tag casing ketat: `<BuyerAdress>` (1 huruf d), `<AddInfo />`, `<CustomDoc />`, `<FacilityStamp />`.
  - Escaping otomatis untuk karakter khusus (`&`, `<`, `>`, `"`, `'`).
  - Penamaan file otomatis sesuai nomor faktur: `${INVOICE_NAME}.xml`.
- **Tax Calculation Engine Berbasis Decimal.js**:
  - Arithmetic presisi tinggi tanpa floating-point rounding error.
  - Multi-strategi: Mendukung perhitungan resmi **Coretax DJP** (sesuai template XML acuan) dan formula custom (faktor 11/12).
- **Normalisasi Identitas Perpajakan**:
  - Konversi otomatis NPWP 15 digit ke 16 digit sesuai PMK Coretax.
  - Resolusi tipe identitas: `TIN`, `NATIONAL_ID`, atau `PASSPORT`.
  - Resolusi kode negara ISO-3 (misal: Indonesia -> `IND`).
  - Pembentukan `SellerIDTKU` dan `BuyerIDTKU`.
- **Keamanan & Validasi**:
  - Proteksi IDOR melalui tanda tangan token HMAC SHA-256.
  - Zero Mutation: Sama sekali tidak mengubah status faktur di Odoo (Draft/Posted tetap utuh).
  - Pesan validasi informatif jika data NPWP, tanggal, atau customer belum lengkap.

---

## 📁 Struktur Direktori

```text
odoo-xml/
├── src/
│   ├── modules/
│   │   └── invoice-export/
│   │       ├── invoice-export.routes.js       # Express routes
│   │       ├── invoice-export.controller.js   # HTTP Controller (Stream XML Download)
│   │       ├── invoice-export.service.js      # Business Service Orchestrator
│   │       ├── invoice-export.validator.js    # Validasi bisnis invoice & partner
│   │       ├── invoice-export.mapper.js       # Pemetaan data Odoo ke Coretax
│   │       ├── invoice-export.test.js         # Unit & E2E tests (17 skenario)
│   │       └── template-parity.test.js        # Parity test dengan TaxInvoiceTemplate.xml
│   │
│   ├── integrations/
│   │   └── odoo/
│   │       ├── odoo.client.js                 # JSON-RPC / External API Odoo 19
│   │       └── odoo.repository.js             # Data access (account.move, lines, partner, company)
│   │
│   ├── xml/
│   │   ├── coretax.generator.js               # Builder XML TaxInvoiceBulk
│   │   └── coretax.validator.js               # Well-formedness & schema validator
│   │
│   ├── tax-engine/
│   │   ├── tax.calculator.js                  # Engine kalkulasi pajak
│   │   └── tax.strategies.js                  # Strategi perhitungan pajak (Decimal.js)
│   │
│   ├── config/
│   │   ├── app.config.js                      # Konfigurasi aplikasi Express
│   │   └── odoo.config.js                     # Konfigurasi koneksi Odoo
│   │
│   ├── utils/
│   │   ├── npwp.utils.js                      # Normalisasi NPWP & Identitas
│   │   ├── xml.utils.js                       # XML Escaping & format tanggal/angka
│   │   └── security.utils.js                  # HMAC Token generator & validator
│   │
│   └── app.js                                 # Entrypoint Express server
│
├── TaxInvoiceTemplate.xml                     # File acuan template resmi Coretax
├── IMPLEMENTATION_PLAN.md                     # Analisis kelayakan & pemetaan teknis
├── ODOO_STUDIO_GUIDE.md                       # Panduan setup tombol Odoo Studio
├── .env.example                               # Contoh environment variables
├── package.json
└── README.md
```

---

## 🚀 Panduan Memulai Cepat

### 1. Prasyarat
- Node.js versi 18+ (Disarankan Node.js 22 LTS).
- Akun pengguna Odoo 19 Online dengan API Key yang memiliki hak akses membaca Invoices.

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Konfigurasi Environment (`.env`)
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Sesuaikan variabel berikut:
```env
PORT=3000
NODE_ENV=production
SECURITY_SECRET=kunci_rahasia_hmac_anda_yang_kuat
REQUIRE_TOKEN_AUTH=true

# Koneksi Odoo 19 Online
ODOO_URL=https://perusahaan-anda.odoo.com
ODOO_DB=perusahaan_db
ODOO_USERNAME=user-api@perusahaan.com
ODOO_API_KEY=kredensial_api_key_odoo_anda

# Strategi Perhitungan: CORETAX_OFFICIAL atau PROMPT_CUSTOM
TAX_STRATEGY=CORETAX_OFFICIAL
DEFAULT_VAT_RATE=12
ODOO_COMPANY_NAME=ISE
```

### 4. Menjalankan Server
Mode Development:
```bash
npm run dev
```

Mode Production:
```bash
npm start
```

---

## 🧪 Menjalankan Pengujian (Automated Testing)

Pengujian mencakup **26 test cases** di 5 suite:
1. Akurasi kalkulasi Decimal.js & pencegahan pembulatan salah.
2. Normalisasi NPWP 15 ke 16 digit & penentuan BuyerDocument.
3. Kepatuhan tag `<BuyerAdress>` dan elemen kosong.
4. 17 skenario bisnis (single line, multi lines, diskon, desimal, buyer luar negeri, penolakan invoice invalid, proteksi IDOR).
5. Parity test 1:1 terhadap `TaxInvoiceTemplate.xml`.

Jalankan pengujian dengan perintah:
```bash
npm test
```

---

## 🔌 API Endpoint

### `GET /api/invoices/:invoiceId/xml`
Mengunduh file XML Coretax dari invoice yang dipilih.

**Query Parameters:**
- `token`: (Wajib jika `REQUIRE_TOKEN_AUTH=true`) Signature HMAC token anti-IDOR.
- `opt`: (Opsional) `A` untuk Goods (Barang), `B` untuk Service (Jasa). Default: `A`.
- `strategy`: (Opsional) `CORETAX_OFFICIAL` atau `PROMPT_CUSTOM`.

**Response:**
- **Status 200**: File binary XML dengan header:
  ```http
  Content-Type: application/xml; charset=utf-8
  Content-Disposition: attachment; filename="INV_2026_0001.xml"
  ```
- **Status 401 / 422**: Pesan JSON deskriptif jika validasi gagal:
  ```json
  {
    "success": false,
    "error": "BUYER_NAME_MISSING",
    "message": "Nama pelanggan wajib diisi."
  }
  ```

---

## 🖥️ Konfigurasi Odoo Studio

Lihat panduan lengkap di [ODOO_STUDIO_GUIDE.md](file:///c:/Users/ysrfa/Downloads/odoo-xml/ODOO_STUDIO_GUIDE.md).

