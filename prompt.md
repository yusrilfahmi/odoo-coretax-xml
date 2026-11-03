# TASK: Implementasi Integrasi Odoo 19 Invoice ke XML Coretax menggunakan Node.js

## 1. Tujuan Utama

Saya ingin mengimplementasikan fitur export Customer Invoice dari Odoo 19 Online menjadi file XML dengan format TaxInvoiceBulk untuk kebutuhan import ke Coretax.

Di Odoo Accounting sudah tersedia tombol **Download** pada halaman Customer Invoice yang dibuat menggunakan Odoo Studio.

Target akhirnya:

1. User membuka salah satu Customer Invoice di Odoo.
2. User menekan tombol Download.
3. Backend Node.js mengambil data invoice yang sedang dibuka dari Odoo.
4. Backend melakukan mapping seluruh field invoice ke struktur XML Coretax.
5. Backend melakukan perhitungan pajak sesuai konfigurasi yang ditentukan.
6. Backend menghasilkan file XML.
7. Browser mengunduh file XML tersebut.

**PENTING:** Jangan membuat sistem yang hanya menghasilkan XML di backend tetapi tidak bisa mengunduhnya melalui tombol Odoo. Integrasi frontend, Odoo, dan backend harus benar-benar berfungsi.

---

# 2. Lingkungan Teknologi

Gunakan konfigurasi berikut:

- ERP: Odoo 19 Online.
- Customization: Odoo Studio.
- Button Action: Run a Server Action.
- Backend: Node.js + Express.
- Odoo API: Evaluasi penggunaan External JSON-2 API Odoo 19.
- Output: XML.
- Target format: TaxInvoiceBulk / TaxInvoice.
- Deployment backend: Server/VPS yang sudah memiliki HTTPS.

Jangan mengasumsikan bahwa Odoo Online memiliki akses seperti Odoo Self-Hosted.

Periksa keterbatasan Odoo Online, terutama:
- Server Action menggunakan Python safe_eval.
- Pembatasan import library Python.
- Kemampuan membuat HTTP request dari Server Action.
- Kemampuan mengembalikan `ir.actions.act_url`.
- Kemampuan Automation Rules mengirim webhook.
- Ketersediaan JSON-2 API berdasarkan paket langganan Odoo.

Jangan mengimplementasikan metode yang tidak didukung Odoo Online.

---

# 3. Arsitektur yang Diharapkan

Target arsitektur:

Odoo Accounting (Customer Invoice)
    |
    | User klik Download
    |
    v
Odoo Studio / Server Action
    |
    | Mengirim invoice ID atau mengarahkan
    | user ke endpoint backend secara aman
    |
    v
Node.js / Express Backend
    |
    | Validasi request
    |
    v
Odoo JSON-2 API
    |
    | Mengambil data account.move
    | Mengambil data account.move.line
    | Mengambil data res.partner
    | Mengambil data res.company
    |
    v
Invoice Data Mapper
    |
    v
Tax Calculation Engine
    |
    v
Coretax XML Generator
    |
    v
XML Validation
    |
    v
HTTP Download Response
    |
    v
Browser Download XML

Jika metode direct download tidak memungkinkan dengan konfigurasi Odoo Studio yang tersedia, analisis alternatif yang paling aman.

Alternatif yang diperbolehkan:
- Odoo Webhook + backend + penyimpanan attachment pada invoice.
- Backend menghasilkan XML lalu menyediakan link download.
- Mekanisme lain yang kompatibel dengan Odoo Online.

Namun, prioritaskan direct download satu klik jika secara teknis memungkinkan.

Jangan mengklaim proses berhasil sebelum benar-benar diuji.

---

# 4. Mapping Data Invoice Odoo ke XML

Gunakan mapping berikut sebagai spesifikasi utama.

## A. Header Tax Invoice

| XML Field | Sumber Odoo | Ketentuan |
|---|---|---|
| TIN | NPWP Seller / ISE | Ambil dari data perusahaan ISE |
| TaxInvoiceDate | Invoice Date | Ambil dari invoice_date |
| TaxInvoiceOpt | Konstanta | Normal |
| TrxCode | Konstanta | 04 |
| AddInfo | Kosong | Empty element |
| CustomDoc | Kosong | Empty element |
| RefDesc | Customer Reference | Ambil dari field Customer Reference invoice |
| FacilityStamp | Kosong | Empty element |
| SellerIDTKU | NPWP Seller / ISE | Ambil dari data perusahaan ISE |

Catatan:
- Jangan hardcode NPWP perusahaan.
- Identifikasi sumber NPWP perusahaan dari konfigurasi company/partner Odoo.
- Identifikasi technical field Customer Reference pada model account.move.
- Jangan mengasumsikan nama technical field tanpa memeriksa metadata Odoo.
- Jika field tidak ditemukan, tampilkan error yang jelas.

## B. Buyer Information

| XML Field | Sumber Odoo | Ketentuan |
|---|---|---|
| BuyerTin | NPWP Buyer | Dari Customer / res.partner |
| BuyerDocument | Auto | Ditentukan berdasarkan identitas buyer |
| BuyerCountry | Auto | Berdasarkan negara customer |
| BuyerDocumentNumber | Auto | Berdasarkan NPWP atau dokumen identitas |
| BuyerName | Customer Name | Nama customer Odoo |
| BuyerAdress | Customer Address | Alamat customer Odoo |
| BuyerEmail | Customer Email | Email customer Odoo |
| BuyerIDTKU | Auto from NPWP | Dibentuk berdasarkan identitas NPWP sesuai aturan Coretax |

PENTING:

1. BuyerDocument harus otomatis ditentukan berdasarkan jenis identitas customer.
2. BuyerCountry harus menggunakan country code sesuai format Coretax.
3. BuyerDocumentNumber harus mengikuti jenis dokumen customer.
4. BuyerName diambil dari nama customer.
5. BuyerAdress harus menggunakan ejaan XML persis seperti template, yaitu `BuyerAdress`, bukan `BuyerAddress`.
6. BuyerEmail diambil dari email customer.
7. BuyerIDTKU harus dihasilkan menggunakan aturan identifikasi TKU yang benar.
8. Jangan menggunakan NPWP contoh dari template sebagai data permanen.

Buat mekanisme normalisasi NPWP:
- Hapus spasi dan karakter pemisah yang tidak diperlukan.
- Pertahankan digit secara utuh.
- Validasi panjang dan format NPWP.
- Jangan mengubah digit NPWP secara sembarangan.
- Bedakan NPWP, NIK, dan identitas perpajakan lainnya.

Jika identitas buyer tidak lengkap, berikan validasi yang menjelaskan field mana yang harus diperbaiki.

---

# 5. Mapping GoodService / Invoice Lines

Setiap invoice line Odoo harus menjadi satu elemen GoodService di dalam ListOfGoodService.

Mapping:

| XML Field | Sumber / Nilai | Ketentuan |
|---|---|---|
| Opt | Manual | Goods atau Service |
| Code | Konstanta | 000000 |
| Name | Konstanta | odoo |
| Unit | Konstanta | Unit |
| Price | Odoo Invoice Line | price_unit |
| Qty | Odoo Invoice Line | quantity |
| TotalDiscount | Odoo Invoice Line | Nilai diskon |
| TaxBase | Tax Calculation | Sesuai rumus pajak |
| OtherTaxBase | Tax Calculation | Sesuai rumus pajak |
| VATRate | Konstanta | 12 |
| VAT | Tax Calculation | OtherTaxBase × VATRate |
| STLGRate | Rate diskon | Sesuai konfigurasi |
| STLG | Tax Calculation | TaxBase × STLGRate |

### Opt: Goods / Service

Sediakan pilihan manual:
- A = Goods / Barang.
- B = Service / Jasa.

Pastikan pilihan ini dapat ditentukan oleh user sebelum export atau melalui konfigurasi yang sesuai.

Jika pilihan belum ditentukan, jangan otomatis memilih salah satu tanpa persetujuan.

### Code

Gunakan nilai:

`000000`

### Name

Gunakan nilai:

`odoo`

### Unit

Gunakan nilai:

`Unit`

### Price

Ambil dari Odoo invoice line:

`price_unit`

### Qty

Ambil dari Odoo invoice line:

`quantity`

### TotalDiscount

Ambil dari diskon invoice line Odoo.

Jika Odoo menyimpan diskon dalam bentuk persentase, hitung nominal diskon berdasarkan quantity dan unit price.

Rumus awal:

`TotalDiscount = Price × Qty × DiscountPercentage / 100`

Pastikan perhitungan tidak menghitung diskon dua kali.

---

# 6. Tax Calculation Engine

Implementasikan perhitungan pajak secara terpisah dari XML generator.

Spesifikasi rumus yang saya berikan:

### TaxBase

`TaxBase = 11 / 12 × Price`

### OtherTaxBase

`OtherTaxBase = 11 / 12 × TaxBase`

### VATRate

`VATRate = 12`

### VAT

`VAT = OtherTaxBase × VATRate / 100`

### STLGRate

`STLGRate = Rate Diskon`

### STLG

`STLG = TaxBase × STLGRate / 100`

PENTING: Rumus tersebut merupakan spesifikasi awal dari saya dan perlu diverifikasi sebelum production.

Ada beberapa hal yang harus dianalisis:

1. Apakah TaxBase dihitung berdasarkan harga satuan atau total nilai transaksi?
2. Apakah quantity harus dikalikan sebelum perhitungan TaxBase?
3. Apakah TotalDiscount dikurangkan sebelum menghitung TaxBase?
4. Apakah OtherTaxBase memang perlu dikalikan 11/12 lagi?
5. Apakah STLG merupakan komponen pajak tambahan atau komponen lain dalam format Coretax?
6. Apakah STLGRate benar-benar menggunakan persentase diskon?

Jangan mengubah rumus secara diam-diam.

Jika rumus yang diberikan berbeda dari ketentuan Coretax, tampilkan:
- Rumus yang saya berikan.
- Rumus yang menurut dokumentasi resmi berlaku.
- Perbedaan hasil perhitungan.
- Rekomendasi implementasi.

Jadikan formula tax engine configurable agar perubahan kebijakan tidak mengharuskan perubahan besar pada XML generator.

Gunakan decimal arithmetic atau library decimal yang sesuai. Hindari floating-point rounding errors.

Tentukan aturan pembulatan berdasarkan spesifikasi resmi Coretax.

---

# 7. Struktur XML Target

Gunakan file XML yang saya lampirkan dengan nama:

`TaxInvoiceTemplate (1).xml`

File tersebut merupakan referensi struktur XML yang harus dipertahankan.

Struktur utamanya:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<TaxInvoiceBulk xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xsi:noNamespaceSchemaLocation="TaxInvoice.xsd">

    <TIN>NPWP_SELLER</TIN>

    <ListOfTaxInvoice>
        <TaxInvoice>

            <TaxInvoiceDate>2026-10-30</TaxInvoiceDate>
            <TaxInvoiceOpt>Normal</TaxInvoiceOpt>
            <TrxCode>04</TrxCode>

            <AddInfo/>
            <CustomDoc/>
            <RefDesc>CUSTOMER_REFERENCE</RefDesc>
            <FacilityStamp/>

            <SellerIDTKU>SELLER_TKU</SellerIDTKU>

            <BuyerTin>BUYER_NPWP</BuyerTin>
            <BuyerDocument>BUYER_DOCUMENT</BuyerDocument>
            <BuyerCountry>IND</BuyerCountry>
            <BuyerDocumentNumber/>
            <BuyerName>BUYER_NAME</BuyerName>
            <BuyerAdress>BUYER_ADDRESS</BuyerAdress>
            <BuyerEmail>BUYER_EMAIL</BuyerEmail>
            <BuyerIDTKU>BUYER_TKU</BuyerIDTKU>

            <ListOfGoodService>

                <GoodService>
                    <Opt>A</Opt>
                    <Code>000000</Code>
                    <Name>odoo</Name>
                    <Unit>Unit</Unit>

                    <Price>15000</Price>
                    <Qty>200</Qty>
                    <TotalDiscount>100000</TotalDiscount>

                    <TaxBase>2900000</TaxBase>
                    <OtherTaxBase>2900000</OtherTaxBase>

                    <VATRate>12</VATRate>
                    <VAT>348000</VAT>

                    <STLGRate>0</STLGRate>
                    <STLG>0</STLG>
                </GoodService>

            </ListOfGoodService>

        </TaxInvoice>
    </ListOfTaxInvoice>

</TaxInvoiceBulk>
```

Catatan:
- Nilai di atas hanya contoh struktur dan placeholder.
- Data harus berasal dari Odoo.
- Pertahankan urutan elemen XML seperti template.
- Pertahankan nama tag persis seperti template.
- Jangan menghapus elemen kosong.
- Jangan mengganti `BuyerAdress` menjadi `BuyerAddress`.
- Jangan membuat struktur XML baru tanpa alasan dan persetujuan.
- XML harus valid dan dapat dibaca parser XML.

Jika ada beberapa invoice lines, buat beberapa elemen GoodService dalam ListOfGoodService.

Jika suatu invoice memiliki 10 baris produk, XML harus memiliki 10 GoodService sesuai data invoice.

Jika terdapat field yang belum diketahui sumbernya, dokumentasikan dan jangan mengisi data palsu.

---

# 8. XML Generator Requirements

Buat modul XML generator yang memiliki tanggung jawab khusus:

1. Menerima object invoice yang sudah dinormalisasi.
2. Menerima array invoice lines.
3. Menerima konfigurasi tax calculation.
4. Menghasilkan XML sesuai template.
5. Melakukan XML escaping.
6. Memastikan karakter khusus seperti &, <, >, tanda kutip, dan karakter Unicode tidak merusak XML.
7. Mempertahankan urutan elemen.
8. Memastikan format tanggal YYYY-MM-DD.
9. Memastikan angka tidak menggunakan format mata uang atau pemisah ribuan.
10. Memastikan nilai kosong direpresentasikan sesuai template.
11. Memvalidasi hasil XML sebelum dikirim ke browser.

Jangan membuat XML menggunakan string concatenation yang rentan terhadap karakter khusus.

Gunakan library XML builder yang sesuai.

Jika tersedia file XSD resmi `TaxInvoice.xsd`, gunakan untuk validasi struktur XML.

Jika file XSD belum tersedia:
- Jangan mengklaim XML telah tervalidasi berdasarkan XSD.
- Lakukan well-formed XML validation.
- Dokumentasikan bahwa validasi skema resmi masih diperlukan.

---

# 9. Odoo Integration

Gunakan Odoo JSON-2 API jika paket langganan mendukung.

Identifikasi model dan field yang diperlukan:

### account.move
- id
- name
- move_type
- state
- invoice_date
- ref / Customer Reference field yang benar
- partner_id
- company_id
- invoice_line_ids
- currency_id
- amount_untaxed
- amount_tax
- amount_total

### account.move.line
- id
- name
- product_id
- quantity
- price_unit
- discount
- price_subtotal
- price_total
- tax_ids
- product_uom_id

### res.partner
- name
- vat
- street
- street2
- city
- state_id
- zip
- country_id
- email
- phone

### res.company
- name
- partner_id
- vat

Jangan berasumsi seluruh technical field di atas tersedia dengan nama yang sama dalam instalasi perusahaan.

Periksa metadata dan lakukan validasi field sebelum implementasi.

Pastikan data perusahaan yang diambil adalah perusahaan ISE yang menerbitkan invoice, bukan perusahaan lain jika database memiliki multi-company.

Ambil hanya data invoice yang sedang dipilih user.

Jangan mengambil seluruh invoice tanpa kebutuhan.

---

# 10. Backend API Design

Buat endpoint yang jelas dan modular.

Contoh:

```http
GET /api/invoices/:invoiceId/xml
```

Fungsi:
- Validasi invoice ID.
- Autentikasi request.
- Ambil data invoice dari Odoo.
- Mapping data.
- Hitung pajak.
- Generate XML.
- Validasi XML.
- Kirim response sebagai file download.

Response header:

```http
Content-Type: application/xml; charset=utf-8
Content-Disposition: attachment; filename="INVOICE-NUMBER.xml"
```

Untuk request yang gagal, kirim error JSON yang informatif.

Contoh:

```json
{
  "success": false,
  "error": "BUYER_NPWP_MISSING",
  "message": "NPWP customer belum diisi."
}
```

Jangan menampilkan API key atau credential dalam error response.

---

# 11. Security Requirements

Keamanan wajib diperhatikan.

1. Jangan menyimpan API key Odoo di frontend.
2. Jangan menaruh credential pada URL.
3. Jangan menggunakan endpoint export yang dapat diakses publik tanpa autentikasi.
4. Validasi identitas user yang melakukan export.
5. Pastikan user hanya dapat mengekspor invoice yang memang boleh diaksesnya.
6. Gunakan HTTPS.
7. Gunakan secret untuk autentikasi webhook.
8. Hindari IDOR pada endpoint invoice export.
9. Validasi request body dan parameter.
10. Jangan menampilkan NPWP lengkap dalam application log jika tidak diperlukan.
11. Jangan menyimpan credential di Git.
12. Gunakan environment variables.

Jika menggunakan webhook asynchronous, buat mekanisme tracking request agar tidak terjadi duplikasi export.

---

# 12. Download Workflow

Prioritaskan pengalaman pengguna satu klik:

1. User membuka Customer Invoice.
2. Klik Download.
3. Sistem mengidentifikasi invoice ID.
4. Backend mengambil data.
5. XML dibuat.
6. Browser langsung mengunduh XML.
7. File menggunakan nama invoice yang sesuai.

Jika Odoo Studio tidak memungkinkan direct binary download:
- Jelaskan keterbatasannya.
- Implementasikan alternatif yang kompatibel.
- Jangan memberikan tombol Download palsu yang hanya mengubah status atau mengirim webhook tanpa menyediakan file.
- Jika perlu menggunakan attachment Odoo, pastikan user mendapatkan cara mengunduh attachment tersebut.

---

# 13. Validasi dan Error Handling

Implementasikan validasi berikut:

### Invoice Validation
- Invoice harus ditemukan.
- move_type harus out_invoice.
- Invoice tidak boleh berasal dari perusahaan yang salah.
- Invoice harus memiliki tanggal invoice.
- Invoice harus memiliki customer.
- Invoice lines harus tersedia.
- Tentukan aturan Draft/Posted berdasarkan kebijakan bisnis, jangan mengubah status invoice.

### Buyer Validation
- NPWP customer tersedia jika diwajibkan.
- Nama customer tersedia.
- Alamat customer tersedia jika diwajibkan.
- Email ditangani sesuai aturan format XML.
- BuyerDocument dapat ditentukan.
- BuyerCountry valid.
- BuyerIDTKU sesuai format.

### Seller Validation
- NPWP ISE tersedia.
- SellerIDTKU tersedia.
- Identitas perusahaan sesuai.

### Tax Validation
- Harga valid.
- Quantity valid.
- Discount valid.
- TaxBase valid.
- OtherTaxBase valid.
- VAT valid.
- STLG valid.

Jika ada kesalahan, jangan menghasilkan XML yang seolah-olah valid.

Berikan pesan error yang bisa dipahami user Odoo.

---

# 14. Testing

Buat test cases minimal berikut:

1. Invoice satu baris produk.
2. Invoice beberapa baris produk.
3. Invoice dengan diskon.
4. Invoice tanpa diskon.
5. Invoice dengan customer NPWP.
6. Invoice dengan data buyer tidak lengkap.
7. Invoice dengan customer luar negeri.
8. Invoice dengan pilihan Goods.
9. Invoice dengan pilihan Service.
10. Invoice dengan harga desimal.
11. Invoice dengan quantity desimal.
12. Invoice dengan karakter khusus pada nama customer.
13. Invoice yang tidak memiliki invoice date.
14. Invoice ID tidak ditemukan.
15. Invoice dari perusahaan selain ISE.
16. Request tanpa autentikasi.
17. Request dengan invoice ID yang tidak diizinkan.

Buat unit test untuk setiap rumus pajak dan XML generator.

Gunakan contoh XML yang saya lampirkan sebagai referensi struktur.

---

# 15. Struktur Project yang Diharapkan

Jika project backend sudah tersedia, ikuti struktur dan coding convention yang sudah digunakan.

Jangan membuat project baru jika sebenarnya modul yang dibutuhkan dapat diintegrasikan ke project existing.

Jika belum ada modul invoice export, gunakan struktur modular seperti:

```text
src/
├── modules/
│   └── invoice-export/
│       ├── invoice-export.routes.js
│       ├── invoice-export.controller.js
│       ├── invoice-export.service.js
│       ├── invoice-export.validator.js
│       ├── invoice-export.mapper.js
│       └── invoice-export.test.js
│
├── integrations/
│   └── odoo/
│       ├── odoo.client.js
│       └── odoo.repository.js
│
├── xml/
│   ├── coretax.generator.js
│   ├── coretax.validator.js
│   └── coretax.mapper.js
│
├── config/
│   └── odoo.config.js
│
└── app.js
```

Pisahkan:
- Odoo integration.
- Business logic.
- Tax calculation.
- XML generation.
- HTTP response.

---

# 16. Aturan Pengerjaan AI Agent

Sebelum mengubah kode, lakukan tahapan berikut:

### Tahap 1 — Audit Project

- Baca seluruh struktur project.
- Identifikasi backend framework.
- Periksa existing routes, middleware, authentication, dan Odoo integration.
- Identifikasi environment variables yang sudah tersedia.
- Jangan merusak fitur existing.
- Periksa apakah sudah ada modul invoice atau XML generator.

### Tahap 2 — Feasibility Analysis

Sebelum coding:
- Pastikan cara mengambil invoice dari Odoo 19 Online.
- Pastikan JSON-2 API tersedia pada paket perusahaan.
- Pastikan mekanisme tombol Studio dapat menjalankan workflow.
- Pastikan mekanisme direct download benar-benar dapat dilakukan.
- Jelaskan keterbatasan jika ada.

### Tahap 3 — Field Mapping

Buat dokumentasi mapping field Odoo ke XML.

Tunjukkan:
- Nama model.
- Technical field.
- XML tag.
- Tipe data.
- Sumber data.
- Aturan transformasi.
- Validasi.

Jangan menebak technical field yang belum diperiksa.

### Tahap 4 — Tax Calculation

Implementasikan tax engine setelah formula dan asumsi perhitungan terdokumentasi.

Jangan mengubah formula yang diberikan tanpa menjelaskan alasannya.

### Tahap 5 — XML Generator

Implementasikan generator berdasarkan file XML template.

Pertahankan struktur dan nama elemen.

### Tahap 6 — Integration

Hubungkan Odoo Studio, Server Action, backend, Odoo API, dan mekanisme download.

### Tahap 7 — Testing

Jalankan seluruh test yang relevan.

Uji integrasi nyata dengan invoice test Odoo jika kredensial dan akses tersedia.

### Tahap 8 — Documentation

Buat dokumentasi:
- Arsitektur.
- Konfigurasi Odoo Studio.
- Konfigurasi backend.
- Environment variables.
- API endpoint.
- Mapping field.
- Formula pajak.
- Cara testing.
- Cara deployment.
- Cara troubleshooting.

---

# 17. Output yang Saya Harapkan dari AI Agent

Setelah pekerjaan selesai, berikan laporan dengan format:

1. **Audit Existing Project**
   - Kondisi project saat ini.
   - File yang relevan.
   - Komponen yang sudah tersedia.

2. **Architecture**
   - Diagram alur Odoo sampai XML download.
   - Penjelasan komunikasi antar-komponen.

3. **Field Mapping**
   - Tabel mapping Odoo ke XML.
   - Technical field yang digunakan.

4. **Tax Calculation**
   - Formula yang diterapkan.
   - Contoh perhitungan.
   - Asumsi dan hal yang belum terverifikasi.

5. **Implementation**
   - Daftar file yang dibuat.
   - Daftar file yang diubah.
   - Penjelasan implementasi.

6. **Odoo Studio Configuration**
   - Langkah konfigurasi tombol Download.
   - Server Action.
   - Automation jika diperlukan.
   - Konfigurasi webhook jika diperlukan.

7. **Testing Results**
   - Test yang berhasil.
   - Test yang gagal.
   - Bug yang masih tersisa.

8. **Deployment Instructions**
   - Environment variables.
   - Konfigurasi server.
   - Cara menjalankan backend.

9. **Final User Workflow**
   - Penjelasan cara user mengekspor invoice melalui Odoo.

---

# 18. Batasan Penting

- Jangan mengubah invoice asli di Odoo.
- Jangan melakukan posting invoice otomatis.
- Jangan mengubah status Draft menjadi Posted.
- Jangan menghapus data invoice.
- Jangan mengirim data ke Coretax secara otomatis.
- Tugas sistem hanya menghasilkan file XML untuk diunduh.
- Jangan mengarang data NPWP, identitas buyer, atau informasi pajak.
- Jangan menggunakan nilai contoh template sebagai nilai permanen.
- Jangan menyimpan file XML ke MinIO kecuali memang diperlukan dan disetujui.
- Jangan menambahkan dependency yang tidak diperlukan.
- Jangan melakukan refactoring besar di luar scope.
- Jangan menyatakan pekerjaan selesai jika direct download belum berhasil diuji.

**Prioritas tertinggi: menghasilkan XML yang sesuai template, mengambil data invoice yang tepat dari Odoo 19, menghitung nilai dengan benar, dan menyediakan download yang benar-benar berfungsi.**

Mulai dari audit project dan feasibility analysis terlebih dahulu. Setelah itu lanjutkan implementasi secara sistematis.