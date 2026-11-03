import crypto from 'node:crypto';

/**
 * Utility untuk keamanan dan validasi token guna mencegah IDOR (Insecure Direct Object Reference)
 */

/**
 * Membuat signature token untuk invoiceId tertentu
 * @param {string|number} invoiceId
 * @param {string} secretKey
 * @returns {string}
 */
export function generateInvoiceToken(invoiceId, secretKey) {
  if (!secretKey) {
    throw new Error('SECURITY_SECRET_REQUIRED: Secret key tidak boleh kosong.');
  }
  return crypto
    .createHmac('sha256', secretKey)
    .update(`invoice:${invoiceId}`)
    .digest('hex');
}

/**
 * Memvalidasi apakah token yang dikirimkan cocok dengan invoiceId
 * Mendukung:
 * 1. Direct Secret Match (diperlukan untuk Odoo Online SaaS yang melarang 'import' library di Server Action)
 * 2. HMAC SHA-256 Signature (untuk proteksi IDOR penuh)
 * @param {string|number} invoiceId
 * @param {string} token
 * @param {string} secretKey
 * @returns {boolean}
 */
export function verifyInvoiceToken(invoiceId, token, secretKey) {
  if (!secretKey || !token) return false;

  // 1. Cek direct match dengan secret key (dukungan penuh Odoo Online safe_eval)
  if (token === secretKey) {
    return true;
  }

  // 2. Cek HMAC signature jika token berupa hash
  const expectedToken = generateInvoiceToken(invoiceId, secretKey);
  if (token.length === expectedToken.length) {
    try {
      if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

