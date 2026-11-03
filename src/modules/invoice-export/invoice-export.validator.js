/**
 * Validator bisnis untuk ekspor invoice Odoo ke Coretax
 */
export class InvoiceExportValidator {
  /**
   * Validasi kelayakan data invoice sebelum diproses
   * @param {object} invoice - Data dari account.move
   * @param {object} company - Data dari res.company
   * @param {object} partner - Data dari res.partner
   * @param {Array<object>} lines - Data dari account.move.line
   * @param {object} options
   */
  static validateRawData({ invoice, company, partner, lines }, options = {}) {
    const errors = [];

    // 1. Validasi Invoice Header
    if (!invoice) {
      errors.push('INVOICE_NOT_FOUND: Invoice tidak ditemukan di sistem Odoo.');
      return { isValid: false, errors };
    }

    if (invoice.move_type !== 'out_invoice') {
      errors.push(`INVALID_MOVE_TYPE: Dokumen harus bertipe Customer Invoice (out_invoice), tipe saat ini: ${invoice.move_type}`);
    }

    if (!invoice.invoice_date) {
      errors.push('MISSING_INVOICE_DATE: Invoice Date belum diisi pada invoice Odoo.');
    }

    // 2. Validasi Perusahaan Penjual (ISE)
    if (!company) {
      errors.push('SELLER_COMPANY_MISSING: Data perusahaan penerbit tidak ditemukan.');
    } else {
      if (options.expectedCompanyName && !company.name?.toLowerCase().includes(options.expectedCompanyName.toLowerCase())) {
        errors.push(`INVALID_COMPANY: Invoice bukan diterbitkan oleh perusahaan ${options.expectedCompanyName} (Perusahaan: ${company.name}).`);
      }
      if (!company.vat) {
        errors.push('SELLER_TIN_MISSING: NPWP Perusahaan penjual (Seller TIN) belum diisi pada setting Company.');
      }
    }

    // 3. Validasi Data Buyer (Pelanggan)
    if (!partner) {
      errors.push('BUYER_PARTNER_MISSING: Data pelanggan (Customer) tidak terhubung.');
    } else {
      if (!partner.name || !partner.name.trim()) {
        errors.push('BUYER_NAME_MISSING: Nama pelanggan wajib diisi.');
      }
    }

    // 4. Validasi Lines Produk
    if (!lines || lines.length === 0) {
      errors.push('EMPTY_INVOICE_LINES: Invoice tidak memiliki baris produk / layanan.');
    } else {
      lines.forEach((line, index) => {
        const lineNum = index + 1;
        if (line.price_unit === undefined || line.price_unit === null || Number(line.price_unit) < 0) {
          errors.push(`INVALID_LINE_PRICE: Baris #${lineNum} (${line.name || 'Produk'}) memiliki harga satuan tidak valid.`);
        }
        if (line.quantity === undefined || line.quantity === null || Number(line.quantity) <= 0) {
          errors.push(`INVALID_LINE_QTY: Baris #${lineNum} (${line.name || 'Produk'}) memiliki kuantitas kurang dari atau sama dengan nol.`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

