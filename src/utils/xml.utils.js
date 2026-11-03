/**
 * Utility untuk sanitasi dan escaping teks XML.
 */

/**
 * Melakukan XML escaping untuk karakter khusus: &, <, >, ", '
 * @param {string|number|null|undefined} value
 * @returns {string}
 */
export function escapeXml(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Hapus karakter kontrol non-XML
}

/**
 * Memastikan nilai angka tidak menggunakan pemisah ribuan atau format desimal selain titik standar.
 * @param {number|string} num
 * @returns {string}
 */
export function formatXmlNumber(num) {
  if (num === null || num === undefined || isNaN(Number(num))) {
    return '0';
  }
  const n = Number(num);
  // Hindari scientific notation untuk angka standar
  return Number.isInteger(n) ? n.toString() : n.toString();
}

/**
 * Format tanggal menjadi YYYY-MM-DD
 * @param {string|Date} dateVal
 * @returns {string}
 */
export function formatXmlDate(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) {
    // Jika format string sudah YYYY-MM-DD
    if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal.trim())) {
      return dateVal.trim();
    }
    return '';
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

