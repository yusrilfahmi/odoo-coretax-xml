/**
 * Repository untuk pengambilan data invoice, lines, partner, dan company dari Odoo 19
 */
export class OdooRepository {
  /**
   * @param {import('./odoo.client.js').OdooClient} odooClient
   */
  constructor(odooClient) {
    this.client = odooClient;
  }

  /**
   * Mengambil data invoice account.move berdasarkan ID
   * @param {number|string} invoiceId
   * @returns {Promise<object|null>}
   */
  async getInvoiceById(invoiceId) {
    const id = Number(invoiceId);
    if (!id || isNaN(id)) {
      throw new Error('INVALID_INVOICE_ID: Format ID invoice tidak valid.');
    }

    const fields = [
      'id',
      'name',
      'move_type',
      'state',
      'invoice_date',
      'ref',
      'partner_id',
      'company_id',
      'invoice_line_ids',
      'currency_id',
      'amount_untaxed',
      'amount_tax',
      'amount_total'
    ];

    const records = await this.client.executeKw('account.move', 'read', [[id]], { fields });
    if (!records || records.length === 0) {
      return null;
    }
    return records[0];
  }

  /**
   * Mengambil data account.move.line berdasarkan array of line IDs
   * @param {Array<number>} lineIds
   * @returns {Promise<Array<object>>}
   */
  async getInvoiceLines(lineIds = []) {
    if (!lineIds || lineIds.length === 0) {
      return [];
    }

    const fields = [
      'id',
      'name',
      'product_id',
      'quantity',
      'price_unit',
      'discount',
      'price_subtotal',
      'price_total',
      'tax_ids',
      'product_uom_id',
      'display_type'
    ];

    const records = await this.client.executeKw('account.move.line', 'read', [lineIds], { fields });
    
    // Filter out note/section lines (hanya ambil baris produk nyata)
    return (records || []).filter(line => !line.display_type || line.display_type === 'product');
  }

  /**
   * Mengambil data pelanggan res.partner
   * @param {number} partnerId
   * @returns {Promise<object|null>}
   */
  async getPartnerById(partnerId) {
    if (!partnerId) return null;

    const fields = [
      'id',
      'name',
      'vat',
      'street',
      'street2',
      'city',
      'state_id',
      'zip',
      'country_id',
      'email',
      'phone'
    ];

    const records = await this.client.executeKw('res.partner', 'read', [[partnerId]], { fields });
    return records && records.length > 0 ? records[0] : null;
  }

  /**
   * Mengambil data perusahaan penerbit res.company
   * @param {number} companyId
   * @returns {Promise<object|null>}
   */
  async getCompanyById(companyId) {
    if (!companyId) return null;

    const fields = ['id', 'name', 'partner_id', 'vat'];
    const records = await this.client.executeKw('res.company', 'read', [[companyId]], { fields });
    return records && records.length > 0 ? records[0] : null;
  }
}

