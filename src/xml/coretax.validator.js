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

    const invoice = Array.isArray(taxInvoiceList) ? taxInvoiceList[0] : taxInvoiceList;

    // Validasi field header
    if (!invoice.TaxInvoiceDate) errors.push('Tag <TaxInvoiceDate> wajib ada.');
    if (!invoice.TaxInvoiceOpt) errors.push('Tag <TaxInvoiceOpt> wajib ada.');
    if (!invoice.TrxCode) errors.push('Tag <TrxCode> wajib ada.');
    if (!invoice.SellerIDTKU) errors.push('Tag <SellerIDTKU> wajib ada.');

    // Validasi Buyer
    if (invoice.BuyerTin === undefined) errors.push('Tag <BuyerTin> wajib ada.');
    if (!invoice.BuyerDocument) errors.push('Tag <BuyerDocument> wajib ada.');
    if (!invoice.BuyerCountry) errors.push('Tag <BuyerCountry> wajib ada.');
    if (invoice.BuyerIDTKU === undefined) errors.push('Tag <BuyerIDTKU> wajib ada.');

    // Validasi Ejaan BuyerAdress (pastikan bukan BuyerAddress)
    if (invoice.BuyerAddress !== undefined) {
      errors.push('Ditemukan tag <BuyerAddress>. Ejaan wajib Coretax adalah <BuyerAdress> (1 huruf d).');
    }

    // Validasi GoodService
    const goodsServices = invoice.ListOfGoodService?.GoodService;
    if (!goodsServices) {
      errors.push('Tag <ListOfGoodService> harus memiliki minimal 1 <GoodService>.');
    } else {
      const items = Array.isArray(goodsServices) ? goodsServices : [goodsServices];
      items.forEach((item, index) => {
        if (!item.Opt) errors.push(`GoodService #${index + 1}: Tag <Opt> wajib ada.`);
        if (item.Price === undefined) errors.push(`GoodService #${index + 1}: Tag <Price> wajib ada.`);
        if (item.Qty === undefined) errors.push(`GoodService #${index + 1}: Tag <Qty> wajib ada.`);
        if (item.TaxBase === undefined) errors.push(`GoodService #${index + 1}: Tag <TaxBase> wajib ada.`);
        if (item.VAT === undefined) errors.push(`GoodService #${index + 1}: Tag <VAT> wajib ada.`);
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      parsed
    };
  }
}

