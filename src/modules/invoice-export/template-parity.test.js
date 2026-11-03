import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { CoretaxXmlGenerator } from '../../xml/coretax.generator.js';
import { CoretaxXmlValidator } from '../../xml/coretax.validator.js';

describe('Parity Test dengan TaxInvoiceTemplate.xml Referensi', () => {
  it('Harus menghasilkan tag dan hierarki yang identik dengan template referensi Coretax', () => {
    const templatePath = path.resolve('TaxInvoiceTemplate.xml');
    assert.ok(fs.existsSync(templatePath), 'File TaxInvoiceTemplate.xml harus ada.');

    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const templateValidation = CoretaxXmlValidator.validate(templateContent);
    assert.strictEqual(templateValidation.isValid, true, 'Template acuan harus valid XML.');

    // Buat data uji persis dengan nilai di template
    const invoiceData = {
      sellerTin: '0802033423617000',
      sellerIdTku: '0802033423617000',
      invoiceDate: '2026-10-30',
      invoiceOpt: 'Normal',
      trxCode: '01',
      refDesc: '',
      buyerTin: '0802033423617000',
      buyerDocument: 'TIN',
      buyerCountry: 'IND',
      buyerDocumentNumber: '',
      buyerName: '',
      buyerAddress: '',
      buyerEmail: 'someemail@gmail.com',
      buyerIdTku: '0802033423617000',
      lines: [
        {
          opt: 'A',
          code: '000000',
          name: 'Barang',
          unit: 'UM.0001',
          price: 15000,
          qty: 200,
          totalDiscount: 100000,
          taxBase: 2900000,
          otherTaxBase: 2900000,
          vatRate: 11,
          vat: 319000,
          stlgRate: 20,
          stlg: 580000
        }
      ]
    };

    const generatedXml = CoretaxXmlGenerator.generate(invoiceData);
    const genValidation = CoretaxXmlValidator.validate(generatedXml);
    assert.strictEqual(genValidation.isValid, true);

    // Bandingkan struktur parsed
    const pTemplate = templateValidation.parsed.TaxInvoiceBulk;
    const pGenerated = genValidation.parsed.TaxInvoiceBulk;

    assert.strictEqual(pGenerated.TIN, pTemplate.TIN);
    assert.strictEqual(pGenerated.ListOfTaxInvoice.TaxInvoice.TaxInvoiceDate, pTemplate.ListOfTaxInvoice.TaxInvoice.TaxInvoiceDate);
    assert.strictEqual(pGenerated.ListOfTaxInvoice.TaxInvoice.BuyerTin, pTemplate.ListOfTaxInvoice.TaxInvoice.BuyerTin);
    assert.strictEqual(pGenerated.ListOfTaxInvoice.TaxInvoice.BuyerIDTKU, pTemplate.ListOfTaxInvoice.TaxInvoice.BuyerIDTKU);

    // Line GoodService
    const lineTemplate = pTemplate.ListOfTaxInvoice.TaxInvoice.ListOfGoodService.GoodService;
    const lineGenerated = pGenerated.ListOfTaxInvoice.TaxInvoice.ListOfGoodService.GoodService;

    assert.strictEqual(lineGenerated.Price, lineTemplate.Price);
    assert.strictEqual(lineGenerated.Qty, lineTemplate.Qty);
    assert.strictEqual(lineGenerated.TotalDiscount, lineTemplate.TotalDiscount);
    assert.strictEqual(lineGenerated.TaxBase, lineTemplate.TaxBase);
    assert.strictEqual(lineGenerated.OtherTaxBase, lineTemplate.OtherTaxBase);
    assert.strictEqual(lineGenerated.VATRate, lineTemplate.VATRate);
    assert.strictEqual(lineGenerated.VAT, lineTemplate.VAT);
    assert.strictEqual(lineGenerated.STLGRate, lineTemplate.STLGRate);
    assert.strictEqual(lineGenerated.STLG, lineTemplate.STLG);
  });
});
