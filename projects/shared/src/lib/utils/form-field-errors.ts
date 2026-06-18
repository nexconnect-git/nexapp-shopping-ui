export type FieldErrors = Record<string, string>;

export interface ParsedFormErrors {
  summary: string;
  fieldErrors: FieldErrors;
}

const DEFAULT_FIELD_LABELS: Record<string, string> = {
  non_field_errors: 'Error',
  nonFieldErrors: 'Error',
  __all__: 'Error',
  detail: 'Error',
  error: 'Error',
};

export function parseFormErrors(
  error: any,
  fieldMap: Record<string, string> = {},
  friendlyMessages: Record<string, string> = {}
): ParsedFormErrors {
  const fieldErrors: FieldErrors = {};
  const summaryMessages: string[] = [];
  const payload = unwrapHttpError(error);

  const assign = (rawField: string, value: any): void => {
    const message = friendlyMessages[rawField] || toMessage(value);
    if (!message) return;

    if (isSummaryField(rawField)) {
      summaryMessages.push(message);
      return;
    }

    const key = fieldMap[rawField] || rawField;
    fieldErrors[key] = message;
  };

  const visit = (value: any): void => {
    if (!value) return;
    if (typeof value === 'string') {
      summaryMessages.push(value);
      return;
    }
    if (Array.isArray(value)) {
      summaryMessages.push(value.map(toMessage).filter(Boolean).join(' '));
      return;
    }
    if (typeof value !== 'object') {
      summaryMessages.push(String(value));
      return;
    }

    Object.entries(value).forEach(([field, fieldValue]) => {
      if (
        field === 'error' &&
        typeof fieldValue === 'object' &&
        !Array.isArray(fieldValue)
      ) {
        visit(fieldValue);
        return;
      }
      assign(field, fieldValue);
    });
  };

  visit(payload);

  return {
    fieldErrors,
    summary:
      Object.values(fieldErrors)[0] ||
      summaryMessages.filter(Boolean).join(' ') ||
      '',
  };
}

export function formatFormErrors(
  error: any,
  fallback = 'Something went wrong. Please try again.',
  fieldLabels: Record<string, string> = {}
): string {
  const parsed = parseFormErrors(error);
  const messages = Object.entries(parsed.fieldErrors)
    .map(([field, message]) => {
      const label = fieldLabels[field] || humanizeFieldName(field);
      return `${label}: ${message}`;
    })
    .filter(Boolean);

  if (
    parsed.summary &&
    !messages.length &&
    !messages.includes(parsed.summary)
  ) {
    messages.push(parsed.summary);
  }

  return messages.join(' ') || fallback;
}

export function firstFieldError(
  fieldErrors: FieldErrors,
  fallback = ''
): string {
  return Object.values(fieldErrors).find(Boolean) || fallback;
}

export function humanizeFieldName(field: string): string {
  const label = DEFAULT_FIELD_LABELS[field];
  if (label) return label;
  return field
    .replace(/\./g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isSummaryField(field: string): boolean {
  return [
    'detail',
    'error',
    'non_field_errors',
    'nonFieldErrors',
    '__all__',
  ].includes(field);
}

function toMessage(value: any): string {
  if (!value) return '';
  if (Array.isArray(value))
    return value.map(toMessage).filter(Boolean).join(' ');
  if (typeof value === 'object')
    return Object.values(value).map(toMessage).filter(Boolean).join(' ');
  return String(value);
}

function unwrapHttpError(error: any): any {
  if (!error || typeof error !== 'object') return error;
  if (
    'error' in error &&
    ('status' in error ||
      'statusText' in error ||
      'url' in error ||
      'name' in error)
  ) {
    return error.error || error.message || error;
  }
  return error;
}
