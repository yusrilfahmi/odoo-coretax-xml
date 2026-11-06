import { TaxCalculationEngine } from '../../tax-engine/tax.calculator.js';
import { CoretaxXmlGenerator } from '../../xml/coretax.generator.js';
import { CoretaxXmlValidator } from '../../xml/coretax.validator.js';
import { InvoiceExportMapper } from './invoice-export.mapper.js';
import { InvoiceExportValidator } from './invoice-export.validator.js';

/**
 * Service orkestrator ekspor faktur pajak Odoo ke XML Coretax
 * Mendukung single invoice maupun multiple invoices (bulk).
 */
export class InvoiceExportService {
  /**
   * @param {import('../../integrations/odoo/odoo.repository.js').OdooRepository} odooRepository
   * @param {import('../../tax-engine/tax.calculator.js').TaxCalculationEngine} taxEngine
   */
  constructor(odooRepository, taxEngine) {
    this.odooRepository = odooRepository;
    this.taxEngine = taxEngine || new TaxCalculationEngine();
  }

  /**
   * Mengambil, memvalidasi, menghitung pajak, dan mapping satu invoice ke format Coretax
   * @param {number|string} invoiceId
   * @param {object} options
   * @returns {Promise<{ coretaxData: object, invoice: object, summary: object }>}
   */
  async _prepareSingleInvoice(invoiceId, options = {}) {
    const numId = Number(invoiceId);
    if (!numId || isNaN(numId)) {
      throw new Error(`INVALID_INVOICE_ID: ID invoice ${invoiceId} tidak valid.`);
    }

    // 1. Ambil data invoice header
    const invoice = await this.odooRepository.getInvoiceById(numId);
    if (!invoice) {
      throw new Error(`INVOICE_NOT_FOUND: Invoice dengan ID ${numId} tidak ditemukan di Odoo.`);
    }

    // 2. Ambil data lines produk
    const lines = await this.odooRepository.getInvoiceLines(invoice.invoice_line_ids || []);

    // 3. Ambil data partner
    const partnerId = Array.isArray(invoice.partner_id) ? invoice.partner_id[0] : invoice.partner_id;
    const partner = await this.odooRepository.getPartnerById(partnerId);

    // 4. Ambil data company
    const companyId = Array.isArray(invoice.company_id) ? invoice.company_id[0] : invoice.company_id;
    const company = await this.odooRepository.getCompanyById(companyId);

    // 5. Validasi data sebelum perhitungan
    const validation = InvoiceExportValidator.validateRawData(
      { invoice, company, partner, lines },
      { expectedCompanyName: options.expectedCompanyName }
    );

    if (!validation.isValid) {
      const err = new Error(validation.errors.join(' | '));
      err.code = 'VALIDATION_FAILED';
      err.details = validation.errors;
      err.invoiceId = numId;
      err.invoiceName = invoice.name || `INV-${numId}`;
      throw err;
    }

    // 6. Hitung nilai perpajakan
    const taxCalculation = this.taxEngine.calculateInvoice(lines, {
      strategy: options.taxStrategy,
      vatRate: options.vatRate,
      stlgRate: options.stlgRate
    });

    // 7. Mapping ke format Coretax
    const coretaxData = InvoiceExportMapper.mapToCoretax(
      {
        invoice,
        company,
        partner,
        calculatedLines: taxCalculation.lines
      },
      options
    );

    return {
      coretaxData,
      invoice,
      summary: taxCalculation.summary
    };
  }

  /**
   * Memproses ekspor satu invoice ke format XML Coretax
   * @param {number|string} invoiceId
   * @param {object} options
   * @returns {Promise<{ xml: string, filename: string, invoice: object, summary: object }>}
   */
  async exportInvoiceToXml(invoiceId, options = {}) {
    const prepared = await this._prepareSingleInvoice(invoiceId, options);

    // Generate XML untuk single invoice
    const xmlContent = CoretaxXmlGenerator.generate(prepared.coretaxData);

    // Validasi hasil XML
    const xmlValidation = CoretaxXmlValidator.validate(xmlContent);
    if (!xmlValidation.isValid) {
      const err = new Error(`GENERATED_XML_INVALID: ${xmlValidation.errors.join('; ')}`);
      err.code = 'XML_VALIDATION_ERROR';
      err.details = xmlValidation.errors;
      throw err;
    }

    // Format nama file download
    const safeInvoiceName = (prepared.invoice.name || `INV-${prepared.invoice.id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeInvoiceName}.xml`;

    return {
      xml: xmlContent,
      filename,
      invoice: prepared.invoice,
      summary: prepared.summary
    };
  }

  /**
   * Memproses ekspor multiple invoices sekaligus ke dalam 1 file XML Coretax (TaxInvoiceBulk)
   * @param {Array<number|string>|string} invoiceIds - Array of IDs atau string dipisahkan koma "1,2,3"
   * @param {object} options
   * @returns {Promise<{ xml: string, filename: string, invoices: Array<object>, count: number }>}
   */
  async exportBulkInvoicesToXml(invoiceIds, options = {}) {
    let ids = [];
    if (typeof invoiceIds === 'string') {
      ids = invoiceIds.split(',').map(s => s.trim()).filter(Boolean);
    } else if (Array.isArray(invoiceIds)) {
      ids = invoiceIds.map(s => String(s).trim()).filter(Boolean);
    }

    if (ids.length === 0) {
      throw new Error('NO_INVOICES_SELECTED: Minimal satu ID invoice harus dipilih untuk diekspor.');
    }

    // Jika hanya 1 invoice, gunakan nama invoice untuk filename yang lebih spesifik
    if (ids.length === 1) {
      const single = await this.exportInvoiceToXml(ids[0], options);
      return {
        xml: single.xml,
        filename: single.filename,
        invoices: [single.invoice],
        count: 1
      };
    }

    const preparedInvoices = [];
    const errors = [];

    for (const id of ids) {
      try {
        const item = await this._prepareSingleInvoice(id, options);
        preparedInvoices.push(item);
      } catch (err) {
        const invLabel = err.invoiceName || `Invoice ID ${id}`;
        errors.push(`[${invLabel}]: ${err.message}`);
      }
    }

    // Jika ada error pada invoice yang dipilih, laporkan secara informatif
    if (errors.length > 0) {
      const err = new Error(`Beberapa invoice tidak valid:\n${errors.join('\n')}`);
      err.code = 'BULK_VALIDATION_FAILED';
      err.details = errors;
      throw err;
    }

    // Ambil semua data Coretax
    const allCoretaxData = preparedInvoices.map(p => p.coretaxData);

    // Generate 1 file XML yang berisi semua TaxInvoice di dalam ListOfTaxInvoice
    const xmlContent = CoretaxXmlGenerator.generate(allCoretaxData);

    // Validasi XML gabungan
    const xmlValidation = CoretaxXmlValidator.validate(xmlContent);
    if (!xmlValidation.isValid) {
      const err = new Error(`GENERATED_XML_INVALID: ${xmlValidation.errors.join('; ')}`);
      err.code = 'XML_VALIDATION_ERROR';
      err.details = xmlValidation.errors;
      throw err;
    }

    // Format nama file: TaxInvoiceBulk_4_Invoices_YYYY-MM-DD.xml
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `TaxInvoiceBulk_${preparedInvoices.length}_Invoices_${dateStr}.xml`;

    return {
      xml: xmlContent,
      filename,
      invoices: preparedInvoices.map(p => p.invoice),
      count: preparedInvoices.length
    };
  }
}
