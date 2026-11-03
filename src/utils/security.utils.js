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
 * @param {string|number} invoiceId
 * @param {string} token
 * @param {string} secretKey
 * @returns {boolean}
 */
export function verifyInvoiceToken(invoiceId, token, secretKey) {
  if (!secretKey || !token) return false;
  const expectedToken = generateInvoiceToken(invoiceId, secretKey);
  
  // Timing safe comparison untuk mencegah timing attack
  if (token.length !== expectedToken.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
}

