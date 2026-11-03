# Server Action di Odoo Studio (Model: account.move)
BASE_BACKEND_URL = "https://backend-anda.com"
API_SECRET = "your_super_secret_hmac_key_here"

import hmac
import hashlib

# Generate HMAC Token untuk mencegah IDOR
message = f"invoice:{record.id}".encode('utf-8')
token = hmac.new(API_SECRET.encode('utf-8'), message, hashlib.sha256).hexdigest()

download_url = f"{BASE_BACKEND_URL}/api/invoices/{record.id}/xml?token={token}"

action = {
    'type': 'ir.actions.act_url',
    'url': download_url,
    'target': 'self', # Mengunduh langsung di browser
}