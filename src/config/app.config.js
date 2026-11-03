import dotenv from 'dotenv';
dotenv.config();

export const appConfig = {
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  securitySecret: process.env.SECURITY_SECRET || 'default_insecure_secret_change_in_production',
  requireTokenAuth: process.env.REQUIRE_TOKEN_AUTH === 'true' || process.env.NODE_ENV === 'production',
  taxCalculationStrategy: process.env.TAX_STRATEGY || 'CORETAX_OFFICIAL', // 'CORETAX_OFFICIAL' atau 'PROMPT_CUSTOM'
  defaultVatRate: process.env.DEFAULT_VAT_RATE ? Number(process.env.DEFAULT_VAT_RATE) : 12,
  defaultTrxCode: process.env.DEFAULT_TRX_CODE || '04'
};

