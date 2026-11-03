/**
 * Utility untuk normalisasi dan validasi identitas perpajakan Indonesia (NPWP, NIK, TKU)
 */

/**
 * Membersihkan format NPWP/NIK dari titik, spasi, tanda minus, dll.
 * @param {string|null|undefined} vat
 * @returns {string}
 */
export function cleanIdNumber(vat) {
  if (!vat) return '';
  return String(vat).replace(/\D/g, '').trim();
}

/**
 * Normalisasi NPWP menjadi format 16 digit sesuai standar Coretax DJP.
 * Jika 15 digit (NPWP lama), tambahkan awalan '0' menjadi 16 digit.
 * @param {string|null|undefined} vat
 * @returns {string}
 */
export function normalizeNpwp16(vat) {
  const cleaned = cleanIdNumber(vat);
  if (!cleaned) return '';
  
  if (cleaned.length === 15) {
    return '0' + cleaned;
  }
  if (cleaned.length === 16) {
    return cleaned;
  }
  return cleaned;
}

/**
 * Menentukan BuyerDocument berdasarkan kelengkapan identitas pelanggan.
 * @param {object} partner - Data customer
 * @returns {{ documentType: string, documentNumber: string, tin: string }}
 */
export function resolveBuyerDocument(partner = {}) {
  const cleanedVat = cleanIdNumber(partner.vat);
  const countryCode = resolveCountryCode(partner.country_code || partner.country_id);

  // Jika negara bukan Indonesia dan tidak ada NPWP Indonesia
  if (countryCode !== 'IND' && (!cleanedVat || (cleanedVat.length !== 15 && cleanedVat.length !== 16))) {
    return {
      documentType: 'PASSPORT',
      documentNumber: partner.vat || partner.ref || '',
      tin: '0000000000000000'
    };
  }

  // Jika NPWP 15 atau 16 digit
  if (cleanedVat.length === 15 || cleanedVat.length === 16) {
    const npwp16 = normalizeNpwp16(cleanedVat);
    return {
      documentType: 'TIN',
      documentNumber: '',
      tin: npwp16
    };
  }

  // Jika 16 digit NIK
  if (cleanedVat.length === 16) {
    return {
      documentType: 'NATIONAL_ID',
      documentNumber: cleanedVat,
      tin: '0000000000000000'
    };
  }

  // Default jika belum diisi
  return {
    documentType: 'TIN',
    documentNumber: '',
    tin: cleanedVat ? normalizeNpwp16(cleanedVat) : ''
  };
}

/**
 * Mengonversi kode negara ke format ISO-3 (misal: ID / Indonesia -> IND)
 * @param {string|object} country
 * @returns {string}
 */
export function resolveCountryCode(country) {
  if (!country) return 'IND';
  
  let code = '';
  if (typeof country === 'string') {
    code = country.toUpperCase().trim();
  } else if (typeof country === 'object') {
    code = (country.code || country.name || '').toUpperCase().trim();
  }

  const mapping = {
    'ID': 'IND',
    'IDN': 'IND',
    'INDONESIA': 'IND',
    'SG': 'SGP',
    'SINGAPORE': 'SGP',
    'MY': 'MYS',
    'MALAYSIA': 'MYS',
    'US': 'USA',
    'USA': 'USA',
    'AU': 'AUS',
    'AUSTRALIA': 'AUS',
    'JP': 'JPN',
    'JAPAN': 'JPN',
    'CN': 'CHN',
    'CHINA': 'CHN'
  };

  return mapping[code] || (code.length === 3 ? code : 'IND');
}

/**
 * Menghasilkan IDTKU (22 digit) sesuai ketentuan Coretax: 16 digit NPWP + 6 angka '0' di belakangnya.
 * @param {string} tin16
 * @param {string} customTku
 * @returns {string}
 */
export function resolveIDTKU(tin16, customTku = '') {
  const cleanedCustom = cleanIdNumber(customTku);
  if (cleanedCustom && cleanedCustom.length === 22) {
    return cleanedCustom;
  }
  const base = normalizeNpwp16(tin16) || '0000000000000000';
  // Selalu tambahkan 6 angka '0' di belakang NPWP 16 digit untuk membentuk IDTKU 22 digit
  if (base.length === 16) {
    return base + '000000';
  }
  if (base.length < 22) {
    return base.padEnd(22, '0');
  }
  return base;
}

