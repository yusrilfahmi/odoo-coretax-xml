import Decimal from 'decimal.js';

// Konfigurasi presisi Decimal
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Strategi Resmi Coretax DJP (Sesuai file template TaxInvoiceTemplate.xml)
 * - Gross = Price * Qty
 * - TotalDiscount = Gross * (discount % / 100) atau nominal diskon
 * - TaxBase (DPP) = Gross - TotalDiscount
 * - OtherTaxBase = TaxBase (atau disesuaikan jika transaksi DPP nilai lain)
 * - VAT = OtherTaxBase * (VATRate / 100)
 * - STLG (PPnBM) = TaxBase * (STLGRate / 100)
 */
export function calculateCoretaxOfficial(line, config = {}) {
  const price = new Decimal(line.price_unit || 0);
  const qty = new Decimal(line.quantity || 1);
  const discountPct = new Decimal(line.discount || 0);
  
  // Gross = Price * Qty
  const gross = price.times(qty);

  // TotalDiscount
  let totalDiscount;
  if (line.discount_amount !== undefined && line.discount_amount !== null) {
    totalDiscount = new Decimal(line.discount_amount);
  } else {
    totalDiscount = gross.times(discountPct).dividedBy(100);
  }

  // TaxBase = Gross - TotalDiscount
  const taxBase = gross.minus(totalDiscount).toDecimalPlaces(2);

  // OtherTaxBase
  const otherTaxBaseFactor = config.otherTaxBaseFactor ? new Decimal(config.otherTaxBaseFactor) : new Decimal(1);
  const otherTaxBase = taxBase.times(otherTaxBaseFactor).toDecimalPlaces(2);

  // VATRate: default 12% (UU HPP) atau 11% sesuai konfigurasi
  const vatRate = new Decimal(config.vatRate !== undefined ? config.vatRate : 12);
  const vat = otherTaxBase.times(vatRate).dividedBy(100).toDecimalPlaces(2);

  // STLGRate (PPnBM)
  const stlgRate = new Decimal(config.stlgRate !== undefined ? config.stlgRate : (line.stlg_rate || 0));
  const stlg = taxBase.times(stlgRate).dividedBy(100).toDecimalPlaces(2);

  return {
    strategyName: 'CORETAX_OFFICIAL',
    price: price.toDecimalPlaces(2).toNumber(),
    qty: qty.toNumber(),
    totalDiscount: totalDiscount.toDecimalPlaces(2).toNumber(),
    taxBase: taxBase.toNumber(),
    otherTaxBase: otherTaxBase.toNumber(),
    vatRate: vatRate.toNumber(),
    vat: vat.toNumber(),
    stlgRate: stlgRate.toNumber(),
    stlg: stlg.toNumber()
  };
}

/**
 * Strategi Awal Sesuai Spesifikasi Dokumen Prompt (Prompt Spec)
 * - TaxBase = 11 / 12 * Price (atau Gross setelah diskon dengan faktor 11/12)
 * - OtherTaxBase = 11 / 12 * TaxBase
 * - VATRate = 12
 * - VAT = OtherTaxBase * VATRate / 100
 * - STLGRate = Rate Diskon
 * - STLG = TaxBase * STLGRate / 100
 */
export function calculatePromptCustom(line, config = {}) {
  const price = new Decimal(line.price_unit || 0);
  const qty = new Decimal(line.quantity || 1);
  const discountPct = new Decimal(line.discount || 0);
  
  const gross = price.times(qty);
  let totalDiscount;
  if (line.discount_amount !== undefined && line.discount_amount !== null) {
    totalDiscount = new Decimal(line.discount_amount);
  } else {
    totalDiscount = gross.times(discountPct).dividedBy(100);
  }

  // Faktor 11 / 12
  const factor11_12 = new Decimal(11).dividedBy(12);

  // Jika dihitung per-unit sesuai teks prompt: TaxBase = 11/12 * Price * Qty (atau per satuan)
  // Untuk menjaga kewajaran total baris: (Gross - TotalDiscount) * 11/12
  const baseAmount = config.promptApplyToGross ? gross.minus(totalDiscount) : price;
  const taxBase = baseAmount.times(factor11_12).toDecimalPlaces(2);

  // OtherTaxBase = 11 / 12 * TaxBase
  const otherTaxBase = taxBase.times(factor11_12).toDecimalPlaces(2);

  const vatRate = new Decimal(config.vatRate !== undefined ? config.vatRate : 12);
  const vat = otherTaxBase.times(vatRate).dividedBy(100).toDecimalPlaces(2);

  const stlgRate = new Decimal(config.stlgRate !== undefined ? config.stlgRate : discountPct);
  const stlg = taxBase.times(stlgRate).dividedBy(100).toDecimalPlaces(2);

  return {
    strategyName: 'PROMPT_CUSTOM',
    price: price.toDecimalPlaces(2).toNumber(),
    qty: qty.toNumber(),
    totalDiscount: totalDiscount.toDecimalPlaces(2).toNumber(),
    taxBase: taxBase.toNumber(),
    otherTaxBase: otherTaxBase.toNumber(),
    vatRate: vatRate.toNumber(),
    vat: vat.toNumber(),
    stlgRate: stlgRate.toNumber(),
    stlg: stlg.toNumber()
  };
}

