import cors from 'cors';
import express from 'express';
import { appConfig } from './config/app.config.js';
import { odooConfig } from './config/odoo.config.js';
import { OdooClient } from './integrations/odoo/odoo.client.js';
import { OdooRepository } from './integrations/odoo/odoo.repository.js';
import { InvoiceExportController } from './modules/invoice-export/invoice-export.controller.js';
import { createInvoiceExportRoutes } from './modules/invoice-export/invoice-export.routes.js';
import { InvoiceExportService } from './modules/invoice-export/invoice-export.service.js';
import { TaxCalculationEngine } from './tax-engine/tax.calculator.js';

export function createApp(customRepository = null) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Setup Dependensi
  const odooClient = new OdooClient(odooConfig);
  const odooRepository = customRepository || new OdooRepository(odooClient);
  const taxEngine = new TaxCalculationEngine(appConfig.taxCalculationStrategy, {
    vatRate: appConfig.defaultVatRate
  });

  const exportService = new InvoiceExportService(odooRepository, taxEngine);
  const exportController = new InvoiceExportController(exportService);

  // Root endpoint untuk health & landing info
  app.get('/', (req, res) => {
    res.json({
      status: 'OK',
      service: 'Odoo 19 Coretax XML Exporter',
      timestamp: new Date().toISOString(),
      strategy: appConfig.taxCalculationStrategy,
      odooConfigured: Boolean(odooConfig.baseUrl && odooConfig.apiKey)
    });
  });

  // Health-check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      strategy: appConfig.taxCalculationStrategy,
      odooConfigured: Boolean(odooConfig.baseUrl && odooConfig.apiKey)
    });
  });

  // Mount API routes
  app.use('/api', createInvoiceExportRoutes(exportController));

  // Global Error Handler
  app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Terjadi kesalahan internal pada server backend.'
    });
  });

  return app;
}

// Jalankan server jika dieksekusi langsung
if (process.argv[1] && process.argv[1].endsWith('app.js')) {
  const app = createApp();
  app.listen(appConfig.port, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Odoo 19 Coretax XML Exporter running on port ${appConfig.port}`);
    console.log(`👉 Tax Strategy: ${appConfig.taxCalculationStrategy}`);
    console.log(`👉 Security Token Required: ${appConfig.requireTokenAuth}`);
    console.log(`=======================================================`);
  });
}

