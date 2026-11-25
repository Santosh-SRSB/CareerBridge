/** GST + tax-invoice helpers for employer subscription billing (exclusive GST). */

export const EMPLOYER_SUBSCRIPTION_GST_RATE_PERCENT = 18;
/** SAC for manpower / recruitment services (matches SRSB tax invoices). */
export const EMPLOYER_SUBSCRIPTION_SAC = '998591';

/** Seller details on subscription tax invoices (SRSB Workforce Solutions). */
export const SRSB_INVOICE_SELLER = {
  legalName: 'SRSB WORKFORCE SOLUTIONS PVT LTD',
  gstin: '29ABQCS9374K1Z6',
  addressLine: 'No. 228/B, 55th Cross, 3rd Block, Rajajinagar, Bangalore - 560010',
  state: 'Karnataka',
  stateCode: '29',
  email: 'srsbhrsolutions25@gmail.com',
  phone: '8317406575 / 8660666087',
  bank: {
    accountName: 'SRSB WORKFORCE SOLUTIONS PVT LTD',
    accountNo: '13340200111222',
    ifsc: 'FDRL0001334',
    branch: 'Rajajinagar',
    bankName: 'Federal Bank',
  },
} as const;

export type GstTaxMode = 'IGST' | 'CGST_SGST';

export type SubscriptionGstBreakdown = {
  taxablePaise: number;
  gstRatePercent: number;
  gstPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  taxMode: GstTaxMode;
  sellerStateCode: string;
  buyerStateCode: string | null;
  placeOfSupply: string;
  sac: string;
};

/** First two digits of GSTIN = Indian state code. */
export function gstinStateCode(gstin: string | null | undefined): string | null {
  const g = String(gstin || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (g.length < 2 || !/^\d{2}/.test(g)) return null;
  return g.slice(0, 2);
}

/**
 * Catalogue / offer amount is taxable value (exclusive of GST).
 * Same state as seller (29 Karnataka) → CGST 9% + SGST 9%; else IGST 18%.
 */
export function computeSubscriptionGst(
  taxablePaise: number,
  buyerGstin?: string | null,
): SubscriptionGstBreakdown {
  const taxable = Math.max(0, Math.round(Number(taxablePaise) || 0));
  const gstPaise = Math.round((taxable * EMPLOYER_SUBSCRIPTION_GST_RATE_PERCENT) / 100);
  const buyerState = gstinStateCode(buyerGstin);
  const sellerState = SRSB_INVOICE_SELLER.stateCode;
  const intraState = Boolean(buyerState && buyerState === sellerState);
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;
  let taxMode: GstTaxMode = 'IGST';
  if (intraState) {
    taxMode = 'CGST_SGST';
    cgstPaise = Math.floor(gstPaise / 2);
    sgstPaise = gstPaise - cgstPaise;
  } else {
    igstPaise = gstPaise;
  }
  return {
    taxablePaise: taxable,
    gstRatePercent: EMPLOYER_SUBSCRIPTION_GST_RATE_PERCENT,
    gstPaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalPaise: taxable + gstPaise,
    taxMode,
    sellerStateCode: sellerState,
    buyerStateCode: buyerState,
    placeOfSupply: buyerState || sellerState,
    sac: EMPLOYER_SUBSCRIPTION_SAC,
  };
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? ` ${ONES[o]}` : ''}`.trim();
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h && rest) return `${ONES[h]} Hundred ${twoDigits(rest)}`;
  if (h) return `${ONES[h]} Hundred`;
  return twoDigits(rest);
}

/** Indian numbering: paise → "… Rupees Only" (paise fraction as And … Paise when non-zero). */
export function amountInWordsInr(paise: number): string {
  const total = Math.max(0, Math.round(Number(paise) || 0));
  const rupees = Math.floor(total / 100);
  const leftoverPaise = total % 100;
  if (rupees === 0 && leftoverPaise === 0) return 'Zero Rupees Only';

  const crore = Math.floor(rupees / 1_00_00_000);
  const lakh = Math.floor((rupees % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((rupees % 1_00_000) / 1000);
  const hundred = rupees % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));

  let out = parts.join(' ').replace(/\s+/g, ' ').trim() || 'Zero';
  out = `${out} Rupee${rupees === 1 ? '' : 's'}`;
  if (leftoverPaise) {
    out += ` And ${twoDigits(leftoverPaise)} Paise`;
  }
  return `${out} Only`;
}

export function formatInrFromPaise(paise: number): string {
  return `₹${(Math.round(paise) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
