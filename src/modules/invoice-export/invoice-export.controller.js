import { appConfig } from '../../config/app.config.js';
import { verifyInvoiceToken } from '../../utils/security.utils.js';

/**
 * Controller untuk menangani HTTP request ekspor invoice XML
 * Mendukung single invoice maupun multiple invoices (bulk).
 */
export class InvoiceExportController {
  /**
   * @param {import('./invoice-export.service.js').InvoiceExportService} service
   */
  constructor(service) {
    this.service = service;
  }

  /**
   * Handler untuk GET & POST /api/invoices/bulk/xml
   */
  exportBulkXml = async (req, res) => {
    try {
      const idsParam = req.query.ids || req.body?.ids || req.params?.invoiceId;
      const { token, opt, strategy, vatRate } = req.query;

      if (!idsParam) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_INVOICE_IDS',
          message: 'Parameter "ids" wajib disertakan (contoh: ?ids=18,19,20,21).'
        });
      }

      // Validasi Token Keamanan jika diwajibkan
      if (appConfig.requireTokenAuth) {
        if (!token || !verifyInvoiceToken('bulk', token, appConfig.securitySecret)) {
          return res.status(401).json({
            success: false,
            error: 'UNAUTHORIZED_ACCESS',
            message: 'Token otentikasi tidak valid atau sudah kedaluwarsa.'
          });
        }
      }

      // Opsi ekspor
      const options = {
        defaultOpt: opt ? opt.toUpperCase() : 'A',
        taxStrategy: strategy || appConfig.taxCalculationStrategy,
        vatRate: vatRate ? Number(vatRate) : appConfig.defaultVatRate
      };

      const result = await this.service.exportBulkInvoicesToXml(idsParam, options);

      // Set Response Headers untuk Direct Download
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      return res.status(200).send(result.xml);
    } catch (err) {
      const statusCode = (err.code === 'VALIDATION_FAILED' || err.code === 'BULK_VALIDATION_FAILED') ? 422 : 
                         err.code === 'INVOICE_NOT_FOUND' ? 404 : 500;

      return res.status(statusCode).json({
        success: false,
        error: err.code || 'EXPORT_ERROR',
        message: err.message,
        details: err.details || undefined
      });
    }
  };

  /**
   * Handler untuk GET /api/invoices/:invoiceId/xml
   */
  exportXml = async (req, res) => {
    try {
      const { invoiceId } = req.params;

      // Jika invoiceId berupa "bulk" atau berisi koma (misal "18,19,20"), delegasikan ke exportBulkXml
      if (invoiceId === 'bulk' || invoiceId.includes(',')) {
        return this.exportBulkXml(req, res);
      }

      const { token, opt, strategy, vatRate } = req.query;

      // 1. Validasi Invoice ID
      const numId = Number(invoiceId);
      if (!numId || isNaN(numId)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_INVOICE_ID',
          message: 'Parameter invoice ID harus berupa angka yang valid.'
        });
      }

      // 2. Validasi Token Keamanan jika diwajibkan (Cegah IDOR)
      if (appConfig.requireTokenAuth) {
        if (!token || !verifyInvoiceToken(numId, token, appConfig.securitySecret)) {
          return res.status(401).json({
            success: false,
            error: 'UNAUTHORIZED_ACCESS',
            message: 'Token otentikasi tidak valid atau sudah kedaluwarsa.'
          });
        }
      }

      // 3. Opsi ekspor
      const options = {
        defaultOpt: opt ? opt.toUpperCase() : 'A',
        taxStrategy: strategy || appConfig.taxCalculationStrategy,
        vatRate: vatRate ? Number(vatRate) : appConfig.defaultVatRate
      };

      // 4. Eksekusi service ekspor
      const result = await this.service.exportInvoiceToXml(numId, options);

      // 5. Set Response Headers untuk Direct Download
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      // 6. Kirim file XML ke browser
      return res.status(200).send(result.xml);

    } catch (err) {
      const statusCode = err.code === 'VALIDATION_FAILED' ? 422 : 
                         err.code === 'INVOICE_NOT_FOUND' ? 404 : 500;

      return res.status(statusCode).json({
        success: false,
        error: err.code || 'EXPORT_ERROR',
        message: err.message,
        details: err.details || undefined
      });
    }
  };

  /**
   * Handler untuk generate token download aman (digunakan oleh Odoo Server Action)
   */
  generateDownloadUrl = async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const numId = Number(invoiceId);
      if (!numId || isNaN(numId)) {
        return res.status(400).json({ success: false, message: 'Invalid ID' });
      }

      const { generateInvoiceToken } = await import('../../utils/security.utils.js');
      const token = generateInvoiceToken(numId, appConfig.securitySecret);
      const host = req.get('host');
      const protocol = req.protocol;
      const downloadUrl = `${protocol}://${host}/api/invoices/${numId}/xml?token=${token}`;

      return res.json({
        success: true,
        invoiceId: numId,
        downloadUrl,
        token
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };
}
