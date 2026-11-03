import { escapeXml, formatXmlDate, formatXmlNumber } from '../utils/xml.utils.js';

/**
 * Generator XML Coretax TaxInvoiceBulk sesuai spesifikasi TaxInvoice.xsd
 */
export class CoretaxXmlGenerator {
  /**
   * Menghasilkan string XML Coretax dari object invoice yang sudah ternormalisasi dan terhitung
   * @param {object} invoiceData
   * @returns {string}
   */
  static generate(invoiceData) {
    if (!invoiceData) {
      throw new Error('INVALID_INVOICE_DATA: Data invoice tidak boleh kosong.');
    }

    const {
      sellerTin = '',
      sellerIdTku = '',
      invoiceDate = '',
      invoiceOpt = 'Normal',
      trxCode = '04',
      refDesc = '',
      buyerTin = '',
      buyerDocument = 'TIN',
      buyerCountry = 'IND',
      buyerDocumentNumber = '',
      buyerName = '',
      buyerAddress = '',
      buyerEmail = '',
      buyerIdTku = '',
      lines = []
    } = invoiceData;

    const formattedDate = formatXmlDate(invoiceDate);

    // Bangun GoodService lines
    const goodServicesXml = lines.map((line) => {
      const opt = line.opt || 'A';
      const code = line.code || '000000';
      const name = line.name || 'odoo';
      const unit = line.unit || 'Unit';
      const price = formatXmlNumber(line.price);
      const qty = formatXmlNumber(line.qty);
      const totalDiscount = formatXmlNumber(line.totalDiscount);
      const taxBase = formatXmlNumber(line.taxBase);
      const otherTaxBase = formatXmlNumber(line.otherTaxBase);
      const vatRate = formatXmlNumber(line.vatRate);
      const vat = formatXmlNumber(line.vat);
      const stlgRate = formatXmlNumber(line.stlgRate);
      const stlg = formatXmlNumber(line.stlg);

      return `        <GoodService>
          <Opt>${escapeXml(opt)}</Opt>
          <Code>${escapeXml(code)}</Code>
          <Name>${escapeXml(name)}</Name>
          <Unit>${escapeXml(unit)}</Unit>
          <Price>${price}</Price>
          <Qty>${qty}</Qty>
          <TotalDiscount>${totalDiscount}</TotalDiscount>
          <TaxBase>${taxBase}</TaxBase>
          <OtherTaxBase>${otherTaxBase}</OtherTaxBase>
          <VATRate>${vatRate}</VATRate>
          <VAT>${vat}</VAT>
          <STLGRate>${stlgRate}</STLGRate>
          <STLG>${stlg}</STLG>
        </GoodService>`;
    }).join('\n');

    // Helper untuk elemen opsional/kosong
    const renderTag = (tagName, value, indent = '      ') => {
      if (value === null || value === undefined || value === '') {
        return `${indent}<${tagName} />`;
      }
      return `${indent}<${tagName}>${escapeXml(value)}</${tagName}>`;
    };

    // Struktur XML persis seperti TaxInvoiceTemplate.xml
    return `<?xml version="1.0" encoding="UTF-8"?>
<TaxInvoiceBulk xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="TaxInvoice.xsd">
  <TIN>${escapeXml(sellerTin)}</TIN>
  <ListOfTaxInvoice>
    <TaxInvoice>
      <TaxInvoiceDate>${formattedDate}</TaxInvoiceDate>
      <TaxInvoiceOpt>${escapeXml(invoiceOpt)}</TaxInvoiceOpt>
      <TrxCode>${escapeXml(trxCode)}</TrxCode>
      <AddInfo />
      <CustomDoc />
${renderTag('RefDesc', refDesc)}
      <FacilityStamp />
      <SellerIDTKU>${escapeXml(sellerIdTku ? (sellerIdTku.length === 16 ? sellerIdTku + '000000' : sellerIdTku) : (sellerTin ? sellerTin + '000000' : '0000000000000000000000'))}</SellerIDTKU>
      <BuyerTin>${escapeXml(buyerTin)}</BuyerTin>
      <BuyerDocument>${escapeXml(buyerDocument)}</BuyerDocument>
      <BuyerCountry>${escapeXml(buyerCountry)}</BuyerCountry>
${renderTag('BuyerDocumentNumber', buyerDocumentNumber)}
${renderTag('BuyerName', buyerName)}
${renderTag('BuyerAdress', buyerAddress)}
${renderTag('BuyerEmail', buyerEmail)}
      <BuyerIDTKU>${escapeXml(buyerIdTku ? (buyerIdTku.length === 16 ? buyerIdTku + '000000' : buyerIdTku) : (buyerTin ? buyerTin + '000000' : '0000000000000000000000'))}</BuyerIDTKU>
      <ListOfGoodService>
${goodServicesXml}
      </ListOfGoodService>
    </TaxInvoice>
  </ListOfTaxInvoice>
</TaxInvoiceBulk>`;
  }
}

