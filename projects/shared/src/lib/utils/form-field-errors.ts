export type FieldErrors = Record<string, string>;

export interface ParsedFormErrors {
  summary: string;
  fieldErrors: FieldErrors;
}

export function parseFormErrors(
  error: any,
  fieldMap: Record<string, string> = {},
  friendlyMessages: Record<string, string> = {},
): ParsedFormErrors {
  const fieldErrors: FieldErrors = {};
  const summaryMessages: string[] = [];

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

  visit(error);

  return {
    fieldErrors,
    summary:
      Object.values(fieldErrors)[0] ||
      summaryMessages.filter(Boolean).join(' ') ||
      '',
  };
}

export function firstFieldError(
  fieldErrors: FieldErrors,
  fallback = '',
): string {
  return Object.values(fieldErrors).find(Boolean) || fallback;
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
