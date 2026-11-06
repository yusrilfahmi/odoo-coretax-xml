import { Router } from 'express';

/**
 * Setup routes untuk modul Invoice Export
 * @param {import('./invoice-export.controller.js').InvoiceExportController} controller
 * @returns {Router}
 */
export function createInvoiceExportRoutes(controller) {
  const router = Router();

  // Endpoint download XML multiple invoices (bulk)
  router.get('/invoices/bulk/xml', controller.exportBulkXml);
  router.post('/invoices/bulk/xml', controller.exportBulkXml);

  // Endpoint download langsung XML satu invoice
  router.get('/invoices/:invoiceId/xml', controller.exportXml);

  // Endpoint untuk generate URL download bertoken aman (opsional jika dibutuhkan server action)
  router.get('/invoices/:invoiceId/token', controller.generateDownloadUrl);

  return router;
}
