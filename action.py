# Server Action di Odoo 19 Online (Model: account.move / Journal Entry)
# Versi 100% kompatibel dengan Python safe_eval Odoo Online (Tanpa import library)

BASE_BACKEND_URL = "https://odoo-coretax-xml.vercel.app"
API_SECRET = "secret_coretax_hanifa_2026"

# Buat URL download dengan token autentikasi
download_url = f"{BASE_BACKEND_URL}/api/invoices/{record.id}/xml?token={API_SECRET}"

action = {
    'type': 'ir.actions.act_url',
    'url': download_url,
    'target': 'self',  # Langsung memicu unduhan file di browser pengguna
}
