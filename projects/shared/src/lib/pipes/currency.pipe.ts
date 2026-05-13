import { Pipe, PipeTransform } from '@angular/core';

const COUNTRY_CURRENCY: Record<string, { code: string; locale: string }> = {
  US: { code: 'USD', locale: 'en-US' },
  GB: { code: 'GBP', locale: 'en-GB' },
  EU: { code: 'EUR', locale: 'en-IE' },
  DE: { code: 'EUR', locale: 'de-DE' },
  FR: { code: 'EUR', locale: 'fr-FR' },
  IT: { code: 'EUR', locale: 'it-IT' },
  ES: { code: 'EUR', locale: 'es-ES' },
  NL: { code: 'EUR', locale: 'nl-NL' },
  BE: { code: 'EUR', locale: 'nl-BE' },
  AT: { code: 'EUR', locale: 'de-AT' },
  PT: { code: 'EUR', locale: 'pt-PT' },
  GR: { code: 'EUR', locale: 'el-GR' },
  FI: { code: 'EUR', locale: 'fi-FI' },
  IE: { code: 'EUR', locale: 'en-IE' },
  IN: { code: 'INR', locale: 'en-IN' },
  JP: { code: 'JPY', locale: 'ja-JP' },
  CN: { code: 'CNY', locale: 'zh-CN' },
  AU: { code: 'AUD', locale: 'en-AU' },
  CA: { code: 'CAD', locale: 'en-CA' },
  SG: { code: 'SGD', locale: 'en-SG' },
  HK: { code: 'HKD', locale: 'zh-HK' },
  AE: { code: 'AED', locale: 'en-AE' },
  SA: { code: 'SAR', locale: 'ar-SA' },
  QA: { code: 'QAR', locale: 'ar-QA' },
  KW: { code: 'KWD', locale: 'ar-KW' },
  BH: { code: 'BHD', locale: 'ar-BH' },
  OM: { code: 'OMR', locale: 'ar-OM' },
  CH: { code: 'CHF', locale: 'de-CH' },
  SE: { code: 'SEK', locale: 'sv-SE' },
  NO: { code: 'NOK', locale: 'nb-NO' },
  DK: { code: 'DKK', locale: 'da-DK' },
  NZ: { code: 'NZD', locale: 'en-NZ' },
  ZA: { code: 'ZAR', locale: 'en-ZA' },
  BR: { code: 'BRL', locale: 'pt-BR' },
  MX: { code: 'MXN', locale: 'es-MX' },
  KR: { code: 'KRW', locale: 'ko-KR' },
  TH: { code: 'THB', locale: 'th-TH' },
  MY: { code: 'MYR', locale: 'ms-MY' },
  ID: { code: 'IDR', locale: 'id-ID' },
  PH: { code: 'PHP', locale: 'en-PH' },
  PK: { code: 'PKR', locale: 'en-PK' },
  BD: { code: 'BDT', locale: 'bn-BD' },
  LK: { code: 'LKR', locale: 'en-LK' },
  NG: { code: 'NGN', locale: 'en-NG' },
  EG: { code: 'EGP', locale: 'ar-EG' },
  TR: { code: 'TRY', locale: 'tr-TR' },
  RU: { code: 'RUB', locale: 'ru-RU' },
  PL: { code: 'PLN', locale: 'pl-PL' },
  CZ: { code: 'CZK', locale: 'cs-CZ' },
  HU: { code: 'HUF', locale: 'hu-HU' },
  IL: { code: 'ILS', locale: 'he-IL' },
};

const LOCATION_BOUNDS: Array<{ country: string; minLat: number; maxLat: number; minLng: number; maxLng: number }> = [
  { country: 'IN', minLat: 6, maxLat: 38, minLng: 68, maxLng: 98 },
  { country: 'US', minLat: 18, maxLat: 72, minLng: -172, maxLng: -66 },
  { country: 'CA', minLat: 42, maxLat: 84, minLng: -142, maxLng: -52 },
  { country: 'GB', minLat: 49, maxLat: 61, minLng: -9, maxLng: 2 },
  { country: 'NG', minLat: 4, maxLat: 14, minLng: 2, maxLng: 15 },
  { country: 'AE', minLat: 22, maxLat: 27, minLng: 51, maxLng: 57 },
  { country: 'SG', minLat: 1, maxLat: 2, minLng: 103, maxLng: 105 },
  { country: 'AU', minLat: -44, maxLat: -10, minLng: 112, maxLng: 154 },
  { country: 'NZ', minLat: -48, maxLat: -34, minLng: 166, maxLng: 179 },
  { country: 'ZA', minLat: -35, maxLat: -22, minLng: 16, maxLng: 33 },
];

function normalizeCountry(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const country = value.trim().toUpperCase();
  return COUNTRY_CURRENCY[country] ? country : null;
}

export function inferCountryFromLocation(location: any): string | null {
  const explicit = normalizeCountry(location?.country || location?.country_code || location?.countryCode);
  if (explicit) return explicit;

  const lat = Number(location?.latitude ?? location?.lat);
  const lng = Number(location?.longitude ?? location?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const match = LOCATION_BOUNDS.find(bounds =>
      lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng
    );
    if (match) return match.country;
  }

  const text = [location?.country_name, location?.address, location?.city, location?.state, location?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/\bindia\b|mumbai|delhi|bengaluru|bangalore|chennai|hyderabad|kolkata|pune/.test(text)) return 'IN';
  if (/\bunited states\b|\busa\b|new york|california|texas|florida/.test(text)) return 'US';
  if (/\bunited kingdom\b|\buk\b|london|england|scotland|wales/.test(text)) return 'GB';
  if (/\bnigeria\b|lagos|abuja/.test(text)) return 'NG';
  return null;
}

function readJson(key: string): any | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getCountry(): string {
  const storedCountry = normalizeCountry(localStorage.getItem('app_country'));
  if (storedCountry) return storedCountry;

  const userCountry = normalizeCountry(readJson('user')?.country);
  if (userCountry) return userCountry;

  const locationCountry = inferCountryFromLocation(readJson('vendor_location') || readJson('customer_guest_location'));
  if (locationCountry) return locationCountry;

  return 'IN';
}

function getCurrencyConfig() {
  return COUNTRY_CURRENCY[getCountry()] || COUNTRY_CURRENCY['IN'];
}

export function setAppCountryFromLocation(location: any): string {
  const country = inferCountryFromLocation(location) || getCountry();
  const config = COUNTRY_CURRENCY[country] || COUNTRY_CURRENCY['IN'];
  localStorage.setItem('app_country', country);
  localStorage.setItem('app_currency_code', config.code);
  localStorage.setItem('vendor_location', JSON.stringify(location || {}));
  return country;
}

export function getCurrencySymbol(): string {
  const { code, locale } = getCurrencyConfig();
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency: code }).formatToParts(0);
  return parts.find(part => part.type === 'currency')?.value || code;
}

@Pipe({ name: 'appCurrency', standalone: true, pure: false })
export class AppCurrencyPipe implements PipeTransform {
  transform(value: number | string | null, symbolOnly = false): string {
    if (symbolOnly) return getCurrencySymbol();
    const { code, locale } = getCurrencyConfig();
    const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
    const amount = Number.isFinite(num) ? num : 0;
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
}
