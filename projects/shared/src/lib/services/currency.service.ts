import { Injectable, computed, signal } from '@angular/core';

export interface CurrencyConfig {
  code: string;
  locale: string;
}

const DEFAULT_COUNTRY = 'IN';

export const COUNTRY_CURRENCY: Record<string, CurrencyConfig> = {
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

const COUNTRY_NAME_ALIASES: Record<string, string> = {
  'UNITED STATES': 'US',
  USA: 'US',
  US: 'US',
  AMERICA: 'US',
  'UNITED KINGDOM': 'GB',
  UK: 'GB',
  GREAT_BRITAIN: 'GB',
  BRITAIN: 'GB',
  ENGLAND: 'GB',
  INDIA: 'IN',
  BHARAT: 'IN',
  NIGERIA: 'NG',
  CANADA: 'CA',
  AUSTRALIA: 'AU',
  'NEW ZEALAND': 'NZ',
  SINGAPORE: 'SG',
  UAE: 'AE',
  'UNITED ARAB EMIRATES': 'AE',
  'SAUDI ARABIA': 'SA',
  QATAR: 'QA',
  KUWAIT: 'KW',
  BAHRAIN: 'BH',
  OMAN: 'OM',
  JAPAN: 'JP',
  CHINA: 'CN',
  'SOUTH AFRICA': 'ZA',
  BRAZIL: 'BR',
  MEXICO: 'MX',
  'SOUTH KOREA': 'KR',
  KOREA: 'KR',
  THAILAND: 'TH',
  MALAYSIA: 'MY',
  INDONESIA: 'ID',
  PHILIPPINES: 'PH',
  PAKISTAN: 'PK',
  BANGLADESH: 'BD',
  'SRI LANKA': 'LK',
  EGYPT: 'EG',
  TURKEY: 'TR',
  RUSSIA: 'RU',
  POLAND: 'PL',
  'CZECH REPUBLIC': 'CZ',
  HUNGARY: 'HU',
  ISRAEL: 'IL',
  GERMANY: 'DE',
  FRANCE: 'FR',
  ITALY: 'IT',
  SPAIN: 'ES',
  NETHERLANDS: 'NL',
  BELGIUM: 'BE',
  AUSTRIA: 'AT',
  PORTUGAL: 'PT',
  GREECE: 'GR',
  FINLAND: 'FI',
  IRELAND: 'IE',
  SWITZERLAND: 'CH',
  SWEDEN: 'SE',
  NORWAY: 'NO',
  DENMARK: 'DK',
};

const LOCATION_BOUNDS: Array<{
  country: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}> = [
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
  const country = value.trim().toUpperCase().replace(/\s+/g, ' ');
  const alias =
    COUNTRY_NAME_ALIASES[country] ||
    COUNTRY_NAME_ALIASES[country.replace(/\s+/g, '_')];
  if (alias && COUNTRY_CURRENCY[alias]) return alias;
  return COUNTRY_CURRENCY[country] ? country : null;
}

function readJson(key: string): any | null {
  if (
    typeof localStorage === 'undefined' ||
    typeof sessionStorage === 'undefined'
  )
    return null;
  try {
    const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storedUserCandidates(): any[] {
  if (typeof localStorage === 'undefined') return [];
  const fixed = [
    'vendor_user',
    'customer_user',
    'delivery_user',
    'admin_user',
    'user',
  ]
    .map((key) => readJson(key))
    .filter(Boolean);

  const dynamic: any[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (
      !key ||
      !key.endsWith('_user') ||
      ['vendor_user', 'customer_user', 'delivery_user', 'admin_user'].includes(
        key,
      )
    )
      continue;
    const value = readJson(key);
    if (value) dynamic.push(value);
  }

  return [...fixed, ...dynamic];
}

export function inferCountryFromLocation(location: any): string | null {
  const explicit = normalizeCountry(
    location?.country ||
      location?.country_code ||
      location?.countryCode ||
      location?.country_name,
  );
  if (explicit) return explicit;

  const lat = Number(location?.latitude ?? location?.lat);
  const lng = Number(location?.longitude ?? location?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const match = LOCATION_BOUNDS.find(
      (bounds) =>
        lat >= bounds.minLat &&
        lat <= bounds.maxLat &&
        lng >= bounds.minLng &&
        lng <= bounds.maxLng,
    );
    if (match) return match.country;
  }

  const text = [
    location?.country,
    location?.country_name,
    location?.address,
    location?.city,
    location?.state,
    location?.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (
    /\bindia\b|mumbai|delhi|bengaluru|bangalore|chennai|hyderabad|kolkata|pune|karnataka|maharashtra|tamil nadu|telangana|kerala/.test(
      text,
    )
  )
    return 'IN';
  if (/\bunited states\b|\busa\b|new york|california|texas|florida/.test(text))
    return 'US';
  if (/\bunited kingdom\b|\buk\b|london|england|scotland|wales/.test(text))
    return 'GB';
  if (/\bnigeria\b|lagos|abuja/.test(text)) return 'NG';
  return null;
}

function getStoredCountry(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_COUNTRY;
  const storedCountry = normalizeCountry(localStorage.getItem('app_country'));
  if (storedCountry) return storedCountry;

  for (const user of storedUserCandidates()) {
    const country = normalizeCountry(
      user?.country || user?.country_code || user?.user_info?.country,
    );
    if (country) return country;
  }

  const locationCountry = inferCountryFromLocation(
    readJson('app_location') ||
      readJson('vendor_location') ||
      readJson('customer_guest_location'),
  );
  if (locationCountry) return locationCountry;

  return DEFAULT_COUNTRY;
}

function persistCountry(country: string, location?: any): void {
  if (typeof localStorage === 'undefined') return;
  const config = COUNTRY_CURRENCY[country] || COUNTRY_CURRENCY[DEFAULT_COUNTRY];
  localStorage.setItem('app_country', country);
  localStorage.setItem('app_currency_code', config.code);
  if (location !== undefined) {
    localStorage.setItem('app_location', JSON.stringify(location || {}));
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('app-currency-changed', {
        detail: { country, currency: config.code },
      }),
    );
  }
}

export function getCurrencyConfig(
  country = getStoredCountry(),
): CurrencyConfig {
  return COUNTRY_CURRENCY[country] || COUNTRY_CURRENCY[DEFAULT_COUNTRY];
}

export function getCurrencySymbol(country = getStoredCountry()): string {
  const { code, locale } = getCurrencyConfig(country);
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
  }).formatToParts(0);
  return parts.find((part) => part.type === 'currency')?.value || code;
}

export function formatCurrency(
  value: number | string | null,
  country = getStoredCountry(),
): string {
  const { code, locale } = getCurrencyConfig(country);
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  const amount = Number.isFinite(num) ? num : 0;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function setAppCountryFromLocation(location: any): string {
  const country = inferCountryFromLocation(location) || getStoredCountry();
  persistCountry(country, location);
  return country;
}

@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private readonly currentCountry = signal(getStoredCountry());
  readonly country = this.currentCountry.asReadonly();
  readonly config = computed(() => getCurrencyConfig(this.currentCountry()));
  readonly symbol = computed(() => getCurrencySymbol(this.currentCountry()));

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('app-currency-changed', () =>
      this.currentCountry.set(getStoredCountry()),
    );
    window.addEventListener('storage', (event) => {
      if (
        event.key === 'app_country' ||
        event.key === 'app_location' ||
        event.key === 'vendor_location' ||
        event.key === 'customer_guest_location'
      ) {
        this.currentCountry.set(getStoredCountry());
      }
    });
  }

  configureFromLocation(location: any): string {
    const country = inferCountryFromLocation(location) || this.currentCountry();
    persistCountry(country, location);
    this.currentCountry.set(country);
    return country;
  }

  format(value: number | string | null): string {
    return formatCurrency(value, this.currentCountry());
  }

  getSymbol(): string {
    return getCurrencySymbol(this.currentCountry());
  }
}
