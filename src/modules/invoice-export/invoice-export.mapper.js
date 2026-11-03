import { normalizeNpwp16, resolveBuyerDocument, resolveCountryCode, resolveIDTKU } from '../../utils/npwp.utils.js';

/**
 * Mapper untuk mentransformasikan raw data Odoo ke normalized data Coretax
 */
export class InvoiceExportMapper {
  /**
   * Mengubah data Odoo ke format input generator Coretax
   * @param {object} param0
   * @param {object} options
   * @returns {object}
   */
  static mapToCoretax({ invoice, company, partner, calculatedLines }, options = {}) {
    const sellerTin = normalizeNpwp16(company?.vat);
    const sellerIdTku = resolveIDTKU(sellerTin);

    const buyerInfo = resolveBuyerDocument(partner);
    const buyerCountry = resolveCountryCode(partner?.country_id || partner?.country_code);
    const buyerIdTku = resolveIDTKU(buyerInfo.tin);

    // Susun alamat pelanggan secara rapi
    const addressParts = [
      partner?.street,
      partner?.street2,
      partner?.city,
      partner?.zip
    ].filter(Boolean);
    const buyerAddress = addressParts.join(', ');

    const mappedLines = (calculatedLines || []).map((line) => {
      // Opt: Default manual atau evaluasi type (A = Goods, B = Service)
      let opt = options.defaultOpt || 'A';
      if (options.lineOpts && options.lineOpts[line.id]) {
        opt = options.lineOpts[line.id];
      }

      // Ambil nama unit persis sesuai yang ada di Odoo (misal: Units, Pcs, Box, kg, dsb.)
      let unitName = '';
      if (Array.isArray(line.product_uom_id) && line.product_uom_id[1]) {
        unitName = line.product_uom_id[1];
      } else if (typeof line.product_uom_id === 'string' && line.product_uom_id.trim()) {
        unitName = line.product_uom_id.trim();
      } else if (Array.isArray(line.product_uom) && line.product_uom[1]) {
        unitName = line.product_uom[1];
      } else if (typeof line.product_uom === 'string' && line.product_uom.trim()) {
        unitName = line.product_uom.trim();
      } else if (Array.isArray(line.uom_id) && line.uom_id[1]) {
        unitName = line.uom_id[1];
      } else if (line.uom_name) {
        unitName = line.uom_name;
      } else if (line.unit) {
        unitName = line.unit;
      } else {
        unitName = 'Unit';
      }

      return {
        id: line.id,
        opt,
        code: line.code || '000000',
        name: line.name ? line.name.replace(/\n/g, ' ').trim() : 'odoo',
        unit: unitName,
        price: line.price,
        qty: line.qty,
        totalDiscount: line.totalDiscount,
        taxBase: line.taxBase,
        otherTaxBase: line.otherTaxBase,
        vatRate: line.vatRate,
        vat: line.vat,
        stlgRate: line.stlgRate,
        stlg: line.stlg
      };
    });

    return {
      invoiceId: invoice.id,
      invoiceName: invoice.name || `INV-${invoice.id}`,
      sellerTin,
      sellerIdTku,
      invoiceDate: invoice.invoice_date,
      invoiceOpt: 'Normal',
      trxCode: options.trxCode || '04',
      refDesc: invoice.ref || '',
      buyerTin: buyerInfo.tin,
      buyerDocument: buyerInfo.documentType,
      buyerCountry,
      buyerDocumentNumber: buyerInfo.documentNumber,
      buyerName: partner?.name || '',
      buyerAddress,
      buyerEmail: partner?.email || '',
      buyerIdTku,
      lines: mappedLines
    };
  }
}

