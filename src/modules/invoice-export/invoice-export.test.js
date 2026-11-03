import assert from 'node:assert';
import { describe, it } from 'node:test';
import { appConfig } from '../../config/app.config.js';
import { TaxCalculationEngine } from '../../tax-engine/tax.calculator.js';
import { normalizeNpwp16, resolveBuyerDocument, resolveCountryCode } from '../../utils/npwp.utils.js';
import { generateInvoiceToken, verifyInvoiceToken } from '../../utils/security.utils.js';
import { escapeXml, formatXmlDate } from '../../utils/xml.utils.js';
import { CoretaxXmlGenerator } from '../../xml/coretax.generator.js';
import { CoretaxXmlValidator } from '../../xml/coretax.validator.js';
import { InvoiceExportService } from './invoice-export.service.js';
import { InvoiceExportValidator } from './invoice-export.validator.js';

// Mock Repository untuk pengujian independen
class MockOdooRepository {
  constructor(customData = {}) {
    this.invoices = customData.invoices || {};
    this.lines = customData.lines || {};
    this.partners = customData.partners || {};
    this.companies = customData.companies || {};
  }

  async getInvoiceById(id) {
    return this.invoices[id] || null;
  }

  async getInvoiceLines(lineIds) {
    return lineIds.map(id => this.lines[id]).filter(Boolean);
  }

  async getPartnerById(id) {
    return this.partners[id] || null;
  }

  async getCompanyById(id) {
    return this.companies[id] || null;
  }
}

// Data dasar untuk mock
const defaultCompany = {
  id: 1,
  name: 'PT ISE INDONESIA',
  vat: '08.020.334.2-361.700'
};

const defaultPartner = {
  id: 10,
  name: 'PT CUSTOMER MITRA & REKAN <TBK>',
  vat: '01.234.567.8-901.000',
  street: 'Jl. Jend. Sudirman Kav. 52',
  city: 'Jakarta Selatan',
  country_id: [100, 'Indonesia'],
  country_code: 'ID',
  email: 'finance@mitra-rekan.co.id'
};

describe('1. Tax Calculation Engine & Decimal Precision', () => {
  const taxEngine = new TaxCalculationEngine();

  it('Harus menghitung rumus Coretax Official secara akurat (sesuai template XML)', () => {
    // 15,000 * 200 = 3,000,000; Diskon 100,000 => TaxBase = 2,900,000; OtherTaxBase = 11/12 * 2,900,000 = 2,658,333.33; VAT 12% => 319,000
    const line = { price_unit: 15000, quantity: 200, discount_amount: 100000, stlg_rate: 20 };
    const res = taxEngine.calculateLine(line, { strategy: 'CORETAX_OFFICIAL', vatRate: 12 });

    assert.strictEqual(res.price, 15000);
    assert.strictEqual(res.qty, 200);
    assert.strictEqual(res.totalDiscount, 100000);
    assert.strictEqual(res.taxBase, 2900000);
    assert.strictEqual(res.otherTaxBase, 2658333.33);
    assert.strictEqual(res.vat, 319000);
    assert.strictEqual(res.stlg, 580000); // 2,900,000 * 20%
  });

  it('Harus menghitung rumus Prompt Custom (Faktor 11/12) dan menghindari floating point rounding error', () => {
    const line = { price_unit: 12000, quantity: 1, discount: 0 };
    const res = taxEngine.calculateLine(line, { strategy: 'PROMPT_CUSTOM', vatRate: 12 });

    // 11/12 * 12000 = 11000
    assert.strictEqual(res.taxBase, 11000);
    // OtherTaxBase = 11/12 * 11000 = 10083.33
    assert.strictEqual(res.otherTaxBase, 10083.33);
    // VAT = 10083.33 * 12% = 1210.00
    assert.strictEqual(res.vat, 1210);
  });

  it('Dapat membandingkan strategi perhitungan untuk dokumentasi analisis', () => {
    const comparison = taxEngine.compareStrategies();
    assert.ok(comparison.promptSpec);
    assert.ok(comparison.coretaxOfficial);
    assert.ok(comparison.differences);
  });
});

describe('2. Utilities: NPWP, XML Escaping, Security Token', () => {
  it('Normalisasi NPWP 15 digit menjadi 16 digit (awalan 0)', () => {
    const npwp15 = '08.020.334.2-361.700';
    assert.strictEqual(normalizeNpwp16(npwp15), '0080203342361700');
  });

  it('Normalisasi NPWP yang sudah 16 digit tetap dipertahankan', () => {
    const npwp16 = '0802033423617000';
    assert.strictEqual(normalizeNpwp16(npwp16), '0802033423617000');
  });

  it('Menentukan BuyerDocument secara dinamis (TIN vs NATIONAL_ID vs PASSPORT)', () => {
    // TIN
    const docTin = resolveBuyerDocument({ vat: '0802033423617000', country_code: 'ID' });
    assert.strictEqual(docTin.documentType, 'TIN');

    // WNA (PASSPORT)
    const docWna = resolveBuyerDocument({ vat: '', country_code: 'SG', ref: 'P1234567' });
    assert.strictEqual(docWna.documentType, 'PASSPORT');
    assert.strictEqual(docWna.documentNumber, 'P1234567');
  });

  it('Resolusi kode negara ke ISO-3 (Indonesia -> IND)', () => {
    assert.strictEqual(resolveCountryCode('ID'), 'IND');
    assert.strictEqual(resolveCountryCode('Indonesia'), 'IND');
    assert.strictEqual(resolveCountryCode('SG'), 'SGP');
  });

  it('XML Escaping menangani karakter khusus &, <, >, ", dan single quote', () => {
    const raw = 'PT "Abadi" & <Maju> \'Jaya\'';
    const escaped = escapeXml(raw);
    assert.strictEqual(escaped, 'PT &quot;Abadi&quot; &amp; &lt;Maju&gt; &apos;Jaya&apos;');
  });

  it('Token Security HMAC SHA-256 memvalidasi invoice ID dan menolak IDOR', () => {
    const secret = 'super-secret-key';
    const token = generateInvoiceToken(12345, secret);

    assert.ok(verifyInvoiceToken(12345, token, secret));
    assert.ok(!verifyInvoiceToken(99999, token, secret)); // IDOR attempt ditolak
    assert.ok(!verifyInvoiceToken(12345, 'wrong-token', secret));
  });
});

describe('3. XML Generator & Validator Compliance', () => {
  it('Menghasilkan tag <BuyerAdress> (1 huruf d) dan bukan <BuyerAddress>', () => {
    const sampleData = {
      sellerTin: '0802033423617000',
      invoiceDate: '2026-10-30',
      buyerTin: '0802033423617000',
      buyerAddress: 'Jl. Sudirman',
      lines: [{ opt: 'A', code: '000000', name: 'Barang', unit: 'Unit', price: 10000, qty: 1, totalDiscount: 0, taxBase: 10000, otherTaxBase: 10000, vatRate: 12, vat: 1200, stlgRate: 0, stlg: 0 }]
    };

    const xml = CoretaxXmlGenerator.generate(sampleData);
    assert.ok(xml.includes('<BuyerAdress>Jl. Sudirman</BuyerAdress>'));
    assert.ok(!xml.includes('<BuyerAddress>'));

    const validation = CoretaxXmlValidator.validate(xml);
    assert.strictEqual(validation.isValid, true);
    assert.strictEqual(validation.errors.length, 0);
  });

  it('Mempertahankan tag elemen kosong seperti <AddInfo />, <CustomDoc />, <FacilityStamp />', () => {
    const sampleData = {
      sellerTin: '0802033423617000',
      invoiceDate: '2026-10-30',
      buyerTin: '0802033423617000',
      lines: [{ price: 10000, qty: 1, taxBase: 10000, otherTaxBase: 10000, vatRate: 12, vat: 1200, stlgRate: 0, stlg: 0 }]
    };

    const xml = CoretaxXmlGenerator.generate(sampleData);
    assert.ok(xml.includes('<AddInfo />'));
    assert.ok(xml.includes('<CustomDoc />'));
    assert.ok(xml.includes('<FacilityStamp />'));
  });
});

describe('4. 17 Skenario Uji Persyaratan Sistem (End-to-End Service Tests)', () => {
  // Setup Mock Repositories
  const mockRepo = new MockOdooRepository({
    companies: { 1: defaultCompany, 2: { id: 2, name: 'PT BINTANG MANDIRI', vat: '123' } },
    partners: {
      10: defaultPartner,
      11: { id: 11, name: 'Customer Tanpa NPWP', vat: '', country_code: 'ID' },
      12: { id: 12, name: 'Overseas Client Pte Ltd', vat: '', country_code: 'SG', ref: 'PASSPORT987' },
      13: { id: 13, name: '', vat: '123' } // Nama kosong
    },
    lines: {
      101: { id: 101, name: 'Produk A', price_unit: 10000, quantity: 2, discount: 0, product_uom_id: [1, 'Pcs'] },
      102: { id: 102, name: 'Produk B dengan Diskon', price_unit: 50000, quantity: 4, discount: 10, product_uom_id: [2, 'Box'] },
      103: { id: 103, name: 'Produk C', price_unit: 25000, quantity: 1, discount: 0, product_uom_id: [3, 'kg'] },
      104: { id: 104, name: 'Harga Desimal', price_unit: 1234.56, quantity: 10, discount: 0 },
      105: { id: 105, name: 'Quantity Desimal', price_unit: 10000, quantity: 2.5, discount: 0 },
      106: { id: 106, name: 'Jasa Konsultasi <Special & Char>', price_unit: 100000, quantity: 1, discount: 0, product_uom_id: [4, 'Hours'] }
    },
    invoices: {
      // 1 & 2: Single vs Multi lines
      1: { id: 1, name: 'INV/2026/0001', move_type: 'out_invoice', invoice_date: '2026-11-01', partner_id: [10], company_id: [1], invoice_line_ids: [101] },
      2: { id: 2, name: 'INV/2026/0002', move_type: 'out_invoice', invoice_date: '2026-11-01', partner_id: [10], company_id: [1], invoice_line_ids: [101, 102, 103] },
      // 3 & 4: Dengan Diskon vs Tanpa Diskon
      3: { id: 3, name: 'INV/2026/0003', move_type: 'out_invoice', invoice_date: '2026-11-01', partner_id: [10], company_id: [1], invoice_line_ids: [102] },
      4: { id: 4, name: 'INV/2026/0004', move_type: 'out_invoice', invoice_date: '2026-11-01', partner_id: [10], company_id: [1], invoice_line_ids: [101] },
      // 5: Customer NPWP
      5: { id: 5, name: 'INV/2026/0005', move_type: 'out_invoice', invoice_date: '2026-11-01', partner_id: [10], company_id: [1], invoice_line_ids: [101] },
      // 6: Customer data tidak lengkap (nama kosong)
      6: { id: 6, name: 'INV/2026/0006', move_type: 'out_invoice', invoice_date: '2026-11-01', partner_id: [13], company_id: [1], invoice_line_ids: [101] },
      // 7: Customer Luar Negeri
      7: { id: 7, name: 'INV/2026/0007', move_type: 'out_invoice', invoice_date: '2026-11-01', partner_id: [12], company_id: [1], invoice_line_ids: [101] },
      // 8 & 9: Goods vs Service
      8: { id: 8, name: 'INV/2026/0008', move_type: 'out_invoice', invoice_date: '2026-11-01', partner_id: [10], company_id: [1], invoice_line_ids: [101] },
      9: { id: 9, name: 'INV/2026/0009', move_type: 'out_invoice', invoice_date: '2026-11-01', partner_id: [10], company_id: [1], invoice_line_ids: [106] },
      // 10 & 11: Harga desimal & Quantity desimal
      10: { id: 10, name: 'INV/2026/0010', move_type: 'out_invoice', invoice_date: '2026-11-01', partner_id: [10], company_id: [1], invoice_line_ids: [104] },
      11: { id: 11, name: 'INV/2026/0011', move_type: 'out_invoice', invoice_date: '2026-11-01', partner_id: [10], company_id: [1], invoice_line_ids: [105] },
      // 12: Karakter khusus pada deskripsi / nama
      12: { id: 12, name: 'INV/2026/0012', move_type: 'out_invoice', invoice_date: '2026-11-01', partner_id: [10], company_id: [1], invoice_line_ids: [106] },
      // 13: Invoice tanpa invoice_date
      13: { id: 13, name: 'INV/2026/0013', move_type: 'out_invoice', invoice_date: null, partner_id: [10], company_id: [1], invoice_line_ids: [101] },
      // 15: Perusahaan selain ISE
      15: { id: 15, name: 'INV/2026/0015', move_type: 'out_invoice', invoice_date: '2026-11-01', partner_id: [10], company_id: [2], invoice_line_ids: [101] }
    }
  });

  const service = new InvoiceExportService(mockRepo);

  it('Test Case 1: Invoice satu baris produk', async () => {
    const res = await service.exportInvoiceToXml(1);
    assert.ok(res.xml);
    assert.strictEqual(res.filename, 'INV_2026_0001.xml');
    assert.strictEqual(res.xml.match(/<GoodService>/g).length, 1);
    assert.ok(res.xml.includes('<Unit>Pcs</Unit>'));
  });

  it('Test Case 2: Invoice beberapa baris produk (3 baris)', async () => {
    const res = await service.exportInvoiceToXml(2);
    assert.strictEqual(res.xml.match(/<GoodService>/g).length, 3);
  });

  it('Test Case 3: Invoice dengan diskon', async () => {
    const res = await service.exportInvoiceToXml(3);
    // 50,000 * 4 = 200,000; diskon 10% = 20,000; TaxBase = 180,000
    assert.ok(res.xml.includes('<TotalDiscount>20000</TotalDiscount>'));
    assert.ok(res.xml.includes('<TaxBase>180000</TaxBase>'));
  });

  it('Test Case 4: Invoice tanpa diskon', async () => {
    const res = await service.exportInvoiceToXml(4);
    assert.ok(res.xml.includes('<TotalDiscount>0</TotalDiscount>'));
  });

  it('Test Case 5: Invoice dengan customer NPWP', async () => {
    const res = await service.exportInvoiceToXml(5);
    assert.ok(res.xml.includes('<BuyerDocument>TIN</BuyerDocument>'));
    assert.ok(res.xml.includes('<BuyerTin>0012345678901000</BuyerTin>'));
    assert.ok(res.xml.includes('<BuyerIDTKU>0012345678901000000000</BuyerIDTKU>'));
    assert.ok(res.xml.includes('<SellerIDTKU>0080203342361700000000</SellerIDTKU>'));
  });

  it('Test Case 6: Invoice dengan data buyer tidak lengkap (menolak & pesan jelas)', async () => {
    await assert.rejects(
      async () => service.exportInvoiceToXml(6),
      err => {
        assert.ok(err.message.includes('BUYER_NAME_MISSING'));
        return true;
      }
    );
  });

  it('Test Case 7: Invoice dengan customer luar negeri (PASSPORT & Non-IND)', async () => {
    const res = await service.exportInvoiceToXml(7);
    assert.ok(res.xml.includes('<BuyerCountry>SGP</BuyerCountry>'));
    assert.ok(res.xml.includes('<BuyerDocument>PASSPORT</BuyerDocument>'));
  });

  it('Test Case 8 & 9: Pilihan Opt A (Goods) dan Opt B (Service)', async () => {
    const resGoods = await service.exportInvoiceToXml(8, { defaultOpt: 'A' });
    assert.ok(resGoods.xml.includes('<Opt>A</Opt>'));

    const resService = await service.exportInvoiceToXml(9, { defaultOpt: 'B' });
    assert.ok(resService.xml.includes('<Opt>B</Opt>'));
  });

  it('Test Case 10 & 11: Harga desimal dan Quantity desimal', async () => {
    const resPriceDec = await service.exportInvoiceToXml(10);
    assert.ok(resPriceDec.xml.includes('<Price>1234.56</Price>'));

    const resQtyDec = await service.exportInvoiceToXml(11);
    assert.ok(resQtyDec.xml.includes('<Qty>2.5</Qty>'));
  });

  it('Test Case 12: Karakter khusus pada nama customer / produk', async () => {
    const res = await service.exportInvoiceToXml(12);
    assert.ok(res.xml.includes('&lt;Special &amp; Char&gt;'));
    const validation = CoretaxXmlValidator.validate(res.xml);
    assert.strictEqual(validation.isValid, true);
  });

  it('Test Case 13: Invoice yang tidak memiliki invoice date (gagal validasi)', async () => {
    await assert.rejects(
      async () => service.exportInvoiceToXml(13),
      err => {
        assert.ok(err.message.includes('MISSING_INVOICE_DATE'));
        return true;
      }
    );
  });

  it('Test Case 14: Invoice ID tidak ditemukan (404 / Error)', async () => {
    await assert.rejects(
      async () => service.exportInvoiceToXml(99999),
      err => {
        assert.ok(err.message.includes('INVOICE_NOT_FOUND'));
        return true;
      }
    );
  });

  it('Test Case 15: Invoice dari perusahaan selain ISE (gagal validasi jika diharapkan ISE)', async () => {
    await assert.rejects(
      async () => service.exportInvoiceToXml(15, { expectedCompanyName: 'ISE' }),
      err => {
        assert.ok(err.message.includes('INVALID_COMPANY'));
        return true;
      }
    );
  });

  it('Test Case 16 & 17: Request tanpa autentikasi & Proteksi IDOR', async () => {
    // Simulasi handler controller dengan token
    const { InvoiceExportController } = await import('./invoice-export.controller.js');
    const controller = new InvoiceExportController(service);

    // Test Case 16: Tanpa token saat requireTokenAuth aktif
    const originalRequireAuth = appConfig.requireTokenAuth;
    appConfig.requireTokenAuth = true;

    try {
      let statusResult = 0;
      let jsonResult = null;
      const mockRes = {
        status: (s) => { statusResult = s; return mockRes; },
        json: (j) => { jsonResult = j; return mockRes; },
        setHeader: () => {}
      };

      // 1. Request tanpa token
      await controller.exportXml({ params: { invoiceId: '1' }, query: {} }, mockRes);
      assert.strictEqual(statusResult, 401);
      assert.strictEqual(jsonResult.error, 'UNAUTHORIZED_ACCESS');

      // 2. Request dengan token invoice lain (IDOR Attack)
      const tokenForOtherInvoice = generateInvoiceToken(2, appConfig.securitySecret);
      await controller.exportXml({ params: { invoiceId: '1' }, query: { token: tokenForOtherInvoice } }, mockRes);
      assert.strictEqual(statusResult, 401);
      assert.strictEqual(jsonResult.error, 'UNAUTHORIZED_ACCESS');

      // 3. Request dengan token valid untuk invoice 1
      const validToken = generateInvoiceToken(1, appConfig.securitySecret);
      let sentBody = '';
      const validRes = {
        status: (s) => { statusResult = s; return validRes; },
        setHeader: () => {},
        send: (b) => { sentBody = b; return validRes; }
      };
      await controller.exportXml({ params: { invoiceId: '1' }, query: { token: validToken } }, validRes);
      assert.strictEqual(statusResult, 200);
      assert.ok(sentBody.includes('<TaxInvoiceBulk'));
    } finally {
      appConfig.requireTokenAuth = originalRequireAuth;
    }
  });
});
