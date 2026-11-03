import { Router } from 'express';

/**
 * Setup routes untuk modul Invoice Export
 * @param {import('./invoice-export.controller.js').InvoiceExportController} controller
 * @returns {Router}
 */
export function createInvoiceExportRoutes(controller) {
  const router = Router();

  // Endpoint download langsung XML
  router.get('/invoices/:invoiceId/xml', controller.exportXml);

  // Endpoint untuk generate URL download bertoken aman (opsional jika dibutuhkan server action)
  router.get('/invoices/:invoiceId/token', controller.generateDownloadUrl);

  return router;
}

