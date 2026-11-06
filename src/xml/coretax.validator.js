import { XMLParser, XMLValidator } from 'fast-xml-parser';

/**
 * Validator untuk XML Coretax
 */
export class CoretaxXmlValidator {
  /**
   * Validasi well-formedness dan struktur skema dasar Coretax
   * @param {string} xmlString
   * @returns {{ isValid: boolean, errors: Array<string>, parsed: object|null }}
   */
  static validate(xmlString) {
    const errors = [];

    if (!xmlString || typeof xmlString !== 'string') {
      return { isValid: false, errors: ['XML string kosong atau tidak valid.'], parsed: null };
    }

    // 1. Validasi Well-formedness sintaks XML
    const syntaxValidation = XMLValidator.validate(xmlString);
    if (syntaxValidation !== true) {
      errors.push(`XML Syntax Error: ${syntaxValidation.err?.msg || 'Sintaks XML tidak valid'}`);
      return { isValid: false, errors, parsed: null };
    }

    // 2. Parse XML untuk validasi struktur konten
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });

    let parsed = null;
    try {
      parsed = parser.parse(xmlString);
    } catch (e) {
      errors.push(`XML Parsing Exception: ${e.message}`);
      return { isValid: false, errors, parsed: null };
    }

    const bulk = parsed.TaxInvoiceBulk;
    if (!bulk) {
      errors.push('Root element <TaxInvoiceBulk> tidak ditemukan.');
      return { isValid: false, errors, parsed };
    }

    if (!bulk.TIN) {
      errors.push('Tag <TIN> seller tidak ditemukan pada root.');
    }

    const taxInvoiceList = bulk.ListOfTaxInvoice?.TaxInvoice;
    if (!taxInvoiceList) {
      errors.push('Tag <ListOfTaxInvoice> atau <TaxInvoice> tidak ditemukan.');
      return { isValid: false, errors, parsed };
    }

    const invoices = Array.isArray(taxInvoiceList) ? taxInvoiceList : [taxInvoiceList];

    invoices.forEach((invoice, invIdx) => {
      const invPrefix = invoices.length > 1 ? `Invoice #${invIdx + 1}: ` : '';

      // Validasi field header
      if (!invoice.TaxInvoiceDate) errors.push(`${invPrefix}Tag <TaxInvoiceDate> wajib ada.`);
      if (!invoice.TaxInvoiceOpt) errors.push(`${invPrefix}Tag <TaxInvoiceOpt> wajib ada.`);
      if (!invoice.TrxCode) errors.push(`${invPrefix}Tag <TrxCode> wajib ada.`);
      if (!invoice.SellerIDTKU) errors.push(`${invPrefix}Tag <SellerIDTKU> wajib ada.`);

      // Validasi Buyer
      if (invoice.BuyerTin === undefined) errors.push(`${invPrefix}Tag <BuyerTin> wajib ada.`);
      if (!invoice.BuyerDocument) errors.push(`${invPrefix}Tag <BuyerDocument> wajib ada.`);
      if (!invoice.BuyerCountry) errors.push(`${invPrefix}Tag <BuyerCountry> wajib ada.`);
      if (invoice.BuyerIDTKU === undefined) errors.push(`${invPrefix}Tag <BuyerIDTKU> wajib ada.`);

      // Validasi Ejaan BuyerAdress (pastikan bukan BuyerAddress)
      if (invoice.BuyerAddress !== undefined) {
        errors.push(`${invPrefix}Ditemukan tag <BuyerAddress>. Ejaan wajib Coretax adalah <BuyerAdress> (1 huruf d).`);
      }

      // Validasi GoodService
      const goodsServices = invoice.ListOfGoodService?.GoodService;
      if (!goodsServices) {
        errors.push(`${invPrefix}Tag <ListOfGoodService> harus memiliki minimal 1 <GoodService>.`);
      } else {
        const items = Array.isArray(goodsServices) ? goodsServices : [goodsServices];
        items.forEach((item, index) => {
          if (!item.Opt) errors.push(`${invPrefix}GoodService #${index + 1}: Tag <Opt> wajib ada.`);
          if (item.Price === undefined) errors.push(`${invPrefix}GoodService #${index + 1}: Tag <Price> wajib ada.`);
          if (item.Qty === undefined) errors.push(`${invPrefix}GoodService #${index + 1}: Tag <Qty> wajib ada.`);
          if (item.TaxBase === undefined) errors.push(`${invPrefix}GoodService #${index + 1}: Tag <TaxBase> wajib ada.`);
          if (item.VAT === undefined) errors.push(`${invPrefix}GoodService #${index + 1}: Tag <VAT> wajib ada.`);
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      parsed
    };
  }
}

