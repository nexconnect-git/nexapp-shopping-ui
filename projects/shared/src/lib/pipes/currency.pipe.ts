import { Pipe, PipeTransform } from '@angular/core';

const COUNTRY_CURRENCY: Record<string, { symbol: string; code: string }> = {
  US: { symbol: '$',   code: 'USD' },
  GB: { symbol: '£',   code: 'GBP' },
  EU: { symbol: '€',   code: 'EUR' },
  DE: { symbol: '€',   code: 'EUR' },
  FR: { symbol: '€',   code: 'EUR' },
  IT: { symbol: '€',   code: 'EUR' },
  ES: { symbol: '€',   code: 'EUR' },
  NL: { symbol: '€',   code: 'EUR' },
  BE: { symbol: '€',   code: 'EUR' },
  AT: { symbol: '€',   code: 'EUR' },
  PT: { symbol: '€',   code: 'EUR' },
  GR: { symbol: '€',   code: 'EUR' },
  FI: { symbol: '€',   code: 'EUR' },
  IE: { symbol: '€',   code: 'EUR' },
  IN: { symbol: '₹',   code: 'INR' },
  JP: { symbol: '¥',   code: 'JPY' },
  CN: { symbol: '¥',   code: 'CNY' },
  AU: { symbol: 'A$',  code: 'AUD' },
  CA: { symbol: 'CA$', code: 'CAD' },
  SG: { symbol: 'S$',  code: 'SGD' },
  HK: { symbol: 'HK$', code: 'HKD' },
  AE: { symbol: 'AED', code: 'AED' },
  SA: { symbol: 'SAR', code: 'SAR' },
  QA: { symbol: 'QAR', code: 'QAR' },
  KW: { symbol: 'KD',  code: 'KWD' },
  BH: { symbol: 'BD',  code: 'BHD' },
  OM: { symbol: 'OMR', code: 'OMR' },
  CH: { symbol: 'CHF', code: 'CHF' },
  SE: { symbol: 'kr',  code: 'SEK' },
  NO: { symbol: 'kr',  code: 'NOK' },
  DK: { symbol: 'kr',  code: 'DKK' },
  NZ: { symbol: 'NZ$', code: 'NZD' },
  ZA: { symbol: 'R',   code: 'ZAR' },
  BR: { symbol: 'R$',  code: 'BRL' },
  MX: { symbol: '$',   code: 'MXN' },
  KR: { symbol: '₩',   code: 'KRW' },
  TH: { symbol: '฿',   code: 'THB' },
  MY: { symbol: 'RM',  code: 'MYR' },
  ID: { symbol: 'Rp',  code: 'IDR' },
  PH: { symbol: '₱',   code: 'PHP' },
  PK: { symbol: '₨',   code: 'PKR' },
  BD: { symbol: '৳',   code: 'BDT' },
  LK: { symbol: '₨',   code: 'LKR' },
  NG: { symbol: '₦',   code: 'NGN' },
  EG: { symbol: 'E£',  code: 'EGP' },
  TR: { symbol: '₺',   code: 'TRY' },
  RU: { symbol: '₽',   code: 'RUB' },
  PL: { symbol: 'zł',  code: 'PLN' },
  CZ: { symbol: 'Kč',  code: 'CZK' },
  HU: { symbol: 'Ft',  code: 'HUF' },
  IL: { symbol: '₪',   code: 'ILS' } };

function getCountry(): string {
  try {
    const raw = localStorage.getItem('user');
    if (raw) {
      const user = JSON.parse(raw);
      return user.country || 'IN';
    }
  } catch { /* ignore */ }
  return 'IN';
}

export function getCurrencySymbol(): string {
  return (COUNTRY_CURRENCY[getCountry()] || COUNTRY_CURRENCY['IN']).symbol;
}

/**
 * AppCurrencyPipe
 *
 * Usage:
 *   {{ price | appCurrency }}        → "$12.50"
 *   {{ 0 | appCurrency:true }}       → "$"   (symbol only, for prefix spans)
 */
@Pipe({ name: 'appCurrency', standalone: true, pure: false })
export class AppCurrencyPipe implements PipeTransform {
  transform(value: number | string | null, symbolOnly = false): string {
    const { symbol } = COUNTRY_CURRENCY[getCountry()] || COUNTRY_CURRENCY['IN'];
    if (symbolOnly) return symbol;
    const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
    return `${symbol}${isNaN(num) ? '0.00' : num.toFixed(2)}`;
  }
}
