import dotenv from 'dotenv';
dotenv.config();

export const odooConfig = {
  baseUrl: process.env.ODOO_URL || 'https://mycompany.odoo.com',
  db: process.env.ODOO_DB || 'mycompany',
  username: process.env.ODOO_USERNAME || '',
  apiKey: process.env.ODOO_API_KEY || '',
  companyId: process.env.ODOO_COMPANY_ID ? Number(process.env.ODOO_COMPANY_ID) : null,
  companyName: process.env.ODOO_COMPANY_NAME || 'ISE',
  timeoutMs: process.env.ODOO_TIMEOUT_MS ? Number(process.env.ODOO_TIMEOUT_MS) : 15000
};

