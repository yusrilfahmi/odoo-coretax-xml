import { calculateCoretaxOfficial, calculatePromptCustom } from './tax.strategies.js';

/**
 * Tax Calculation Engine Modular
 */
export class TaxCalculationEngine {
  constructor(defaultStrategy = 'CORETAX_OFFICIAL', globalConfig = {}) {
    this.strategy = defaultStrategy;
    this.globalConfig = globalConfig;
  }

  /**
   * Menghitung nilai perpajakan untuk satu baris item
   * @param {object} line
   * @param {object} overrideConfig
   * @returns {object}
   */
  calculateLine(line, overrideConfig = {}) {
    const config = { ...this.globalConfig, ...overrideConfig };
    const strategyName = config.strategy || this.strategy;

    if (strategyName === 'PROMPT_CUSTOM') {
      return calculatePromptCustom(line, config);
    }
    return calculateCoretaxOfficial(line, config);
  }

  /**
   * Menghitung perpajakan untuk seluruh baris item invoice
   * @param {Array<object>} lines
   * @param {object} overrideConfig
   * @returns {{ lines: Array<object>, summary: object }}
   */
  calculateInvoice(lines = [], overrideConfig = {}) {
    let sumTaxBase = 0;
    let sumOtherTaxBase = 0;
    let sumVat = 0;
    let sumStlg = 0;

    const calculatedLines = lines.map((line, idx) => {
      const calc = this.calculateLine(line, overrideConfig);
      sumTaxBase += calc.taxBase;
      sumOtherTaxBase += calc.otherTaxBase;
      sumVat += calc.vat;
      sumStlg += calc.stlg;

      return {
        ...line,
        ...calc,
        lineIndex: idx + 1
      };
    });

    return {
      lines: calculatedLines,
      summary: {
        totalTaxBase: Math.round(sumTaxBase * 100) / 100,
        totalOtherTaxBase: Math.round(sumOtherTaxBase * 100) / 100,
        totalVat: Math.round(sumVat * 100) / 100,
        totalStlg: Math.round(sumStlg * 100) / 100
      }
    };
  }

  /**
   * Memberikan perbandingan hasil antara spesifikasi awal prompt vs resmi Coretax
   * @param {object} sampleLine
   * @returns {{ promptSpec: object, coretaxOfficial: object, differences: object }}
   */
  compareStrategies(sampleLine = { price_unit: 15000, quantity: 200, discount: 0, discount_amount: 100000 }) {
    const promptSpec = calculatePromptCustom(sampleLine, { promptApplyToGross: true, vatRate: 12 });
    const coretaxOfficial = calculateCoretaxOfficial(sampleLine, { vatRate: 12 });

    return {
      promptSpec,
      coretaxOfficial,
      differences: {
        taxBaseDiff: coretaxOfficial.taxBase - promptSpec.taxBase,
        otherTaxBaseDiff: coretaxOfficial.otherTaxBase - promptSpec.otherTaxBase,
        vatDiff: coretaxOfficial.vat - promptSpec.vat
      }
    };
  }
}

