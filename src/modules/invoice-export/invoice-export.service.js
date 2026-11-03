import { TaxCalculationEngine } from '../../tax-engine/tax.calculator.js';
import { CoretaxXmlGenerator } from '../../xml/coretax.generator.js';
import { CoretaxXmlValidator } from '../../xml/coretax.validator.js';
import { InvoiceExportMapper } from './invoice-export.mapper.js';
import { InvoiceExportValidator } from './invoice-export.validator.js';

/**
 * Service orkestrator ekspor faktur pajak Odoo ke XML Coretax
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
   * Memproses ekspor invoice Odoo ke format XML Coretax
   * @param {number|string} invoiceId
   * @param {object} options
   * @returns {Promise<{ xml: string, filename: string, invoice: object, summary: object }>}
   */
  async exportInvoiceToXml(invoiceId, options = {}) {
    // 1. Ambil data invoice header
    const invoice = await this.odooRepository.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error(`INVOICE_NOT_FOUND: Invoice dengan ID ${invoiceId} tidak ditemukan di Odoo.`);
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

    // 8. Generate XML
    const xmlContent = CoretaxXmlGenerator.generate(coretaxData);

    // 9. Validasi hasil XML
    const xmlValidation = CoretaxXmlValidator.validate(xmlContent);
    if (!xmlValidation.isValid) {
      const err = new Error(`GENERATED_XML_INVALID: ${xmlValidation.errors.join('; ')}`);
      err.code = 'XML_VALIDATION_ERROR';
      err.details = xmlValidation.errors;
      throw err;
    }

    // 10. Format nama file download: Bersihkan karakter tidak ramah file sistem
    const safeInvoiceName = (invoice.name || `INV-${invoice.id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeInvoiceName}.xml`;

    return {
      xml: xmlContent,
      filename,
      invoice,
      summary: taxCalculation.summary
    };
  }
}

