export const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
export const INDIA_MOBILE_PATTERN = /^[6-9]\d{9}$/;
export const INDIA_PINCODE_PATTERN = /^[1-9]\d{5}$/;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,30}$/;

export function sanitizeEmail(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._%+-]/g, '');
}

export function sanitizeUsername(value: unknown): string {
  return String(value ?? '')
    .replace(/[^a-zA-Z0-9_.-]/g, '')
    .slice(0, 30);
}

export function sanitizeDigits(value: unknown, maxLength?: number): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  return maxLength ? digits.slice(0, maxLength) : digits;
}

export function normalizeIndianPhone(value: unknown): string {
  const digits = sanitizeDigits(value);
  if (digits.length > 10 && digits.startsWith('91')) return digits.slice(2, 12);
  return digits.slice(0, 10);
}

export function isValidEmail(value: unknown): boolean {
  return EMAIL_PATTERN.test(sanitizeEmail(value));
}

export function isValidIndianPhone(value: unknown): boolean {
  return INDIA_MOBILE_PATTERN.test(normalizeIndianPhone(value));
}

export function stripControlCharacters(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
}
