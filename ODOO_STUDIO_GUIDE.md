# Panduan Konfigurasi Tombol Download Coretax XML di Odoo 19 Online

Dokumen ini menjelaskan langkah demi langkah untuk mengonfigurasi tombol **Download XML Coretax** pada halaman Customer Invoice (`account.move`) di **Odoo 19 Online** menggunakan **Odoo Studio** dan **Server Action**.

---

## 1. Memahami Batasan Odoo 19 Online (SaaS)

Di Odoo Online (SaaS):
1. Python interpreter di Server Action berjalan dalam mode **`safe_eval`**.
2. Anda **tidak dapat** melakukan `import requests` atau `import urllib` di dalam Server Action.
3. Anda **tidak dapat** menulis file langsung ke disk server Odoo.
4. Namun, Odoo **sepenuhnya mendukung** pengembalian Window Action bertipe `ir.actions.act_url`. Action ini menginstruksikan browser pengguna untuk langsung membuka/mengunduh file dari URL backend tanpa reload halaman.

---

## 2. Langkah Konfigurasi Odoo Studio

### Langkah 1: Buka Formulir Customer Invoice
1. Masuk ke aplikasi **Accounting** (Invoicing) di Odoo 19.
2. Buka menu **Customers > Invoices**.
3. Buka salah satu Customer Invoice (bisa dalam status Draft maupun Posted).

### Langkah 2: Aktifkan Odoo Studio
1. Klik ikon **Studio** (ikon obeng/tang) di sudut kanan atas layar.
2. Form view Customer Invoice kini berada dalam mode pengeditan Studio.

### Langkah 3: Tambahkan Tombol di Header Formulir
1. Pada bilah atas (Header) form invoice, klik **Add a button** (atau tarik komponen Button ke area header di samping tombol *Confirm* / *Send & Print*).
2. Beri label tombol:
   - **Label**: `Download XML Coretax`
   - **Action**: Pilih `Run a Server Action`
3. Klik tanda panah atau **Create** untuk membuat Server Action baru.

---

## 3. Konfigurasi Server Action (Python Safe Eval)

Buka konfigurasi Server Action yang baru dibuat:
- **Action Name**: `Action Export XML Coretax`
- **Model**: `Invoice` (`account.move`)
- **Action To Do**: `Execute Code (Python Code)`

### Kode Python untuk Odoo 19 Online Server Action:

#### Opsi 1: Direct Download Aman (Disarankan)
Jika backend Anda mengaktifkan validasi token HMAC (anti-IDOR):

```python
# Server Action: Download Coretax XML
# Model: account.move
# Pastikan URL mengarah ke domain backend HTTPS Anda

BASE_BACKEND_URL = "https://backend-anda.com"
# Secret key harus sama dengan SECURITY_SECRET di .env backend Anda
SECRET_KEY = "your_super_secret_hmac_key_here"

import hmac
import hashlib

# Generate HMAC SHA256 signature
message = f"invoice:{record.id}".encode('utf-8')
token = hmac.new(SECRET_KEY.encode('utf-8'), message, hashlib.sha256).hexdigest()

download_url = f"{BASE_BACKEND_URL}/api/invoices/{record.id}/xml?token={token}"

action = {
    'type': 'ir.actions.act_url',
    'url': download_url,
    'target': 'self',  # 'self' langsung memicu download di browser tanpa membuka tab baru kosong
}
```

> [!NOTE]
> Jika Odoo Online Anda membatasi modul `hmac` atau `hashlib` di safe_eval, Anda dapat menggunakan Opsi 2 di bawah ini.

#### Opsi 2: Direct Download dengan API Secret Token
Jika Anda ingin kode Python yang paling sederhana dan 100% kompatibel dengan safe_eval Odoo Online:

```python
# Server Action: Direct Download URL
BASE_BACKEND_URL = "https://backend-anda.com"
API_SECRET = "your_super_secret_hmac_key_here"

download_url = f"{BASE_BACKEND_URL}/api/invoices/{record.id}/xml?token={API_SECRET}"

action = {
    'type': 'ir.actions.act_url',
    'url': download_url,
    'target': 'self',
}
```

---

## 4. Alur Kerja Pengguna Akhir (User Experience)

1. Staf Accounting membuka Customer Invoice di Odoo 19 Online.
2. Memeriksa apakah data NPWP Customer sudah terisi di tab *Other Info* / profil partner.
3. Menekan tombol **Download XML Coretax** di header invoice.
4. Server Action Odoo mereturn `ir.actions.act_url`.
5. Browser secara instan mengunduh file XML:
   - Contoh nama file: `INV_2026_0001.xml`.
   - Content-Type: `application/xml`.
6. File XML tersebut siap langsung diimpor ke aplikasi **Coretax DJP**.

---

## 5. Troubleshooting Masalah Umum

| Gejala Masalah | Penyebab | Solusi |
| :--- | :--- | :--- |
| **HTTP 401 Unauthorized** | Token di URL tidak sesuai dengan `SECURITY_SECRET` di backend. | Samakan nilai `SECRET_KEY` di Server Action dengan `SECURITY_SECRET` di `.env` backend. |
| **HTTP 422 BUYER_NAME_MISSING** | Data customer tidak memiliki nama. | Isi nama customer pada invoice sebelum download. |
| **HTTP 422 SELLER_TIN_MISSING** | Company ISE belum diisi NPWP-nya. | Buka menu *Settings > Companies*, pilih perusahaan ISE, lalu isi field *Tax ID / VAT*. |
| **Browser memblokir unduhan** | Backend tidak menggunakan HTTPS. | Pastikan backend Node.js menggunakan domain ber-SSL/HTTPS yang valid. |
| **Status invoice berubah** | Dilarang oleh aturan sistem. | Server Action ini **murni read-only** dan tidak mengubah state invoice. |

