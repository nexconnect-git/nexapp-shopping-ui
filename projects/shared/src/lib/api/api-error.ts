export interface ApiErrorBody {
  code?: string;
  detail?: string;
  message?: string;
  errors?: Record<string, unknown>;
}

export function apiErrorMessage(error: unknown, fallback = 'Request failed'): string {
  const body = (error as any)?.error || error;
  const fieldMessage = formatFieldErrors(body);
  return (
    fieldMessage ||
    body?.detail ||
    body?.message ||
    (typeof body === 'string' ? body : '') ||
    fallback
  );
}

function formatFieldErrors(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';

  const body = value as Record<string, unknown>;
  const nested =
    body['errors'] && typeof body['errors'] === 'object'
      ? (body['errors'] as Record<string, unknown>)
      : body;

  return Object.entries(nested)
    .filter(([field]) => !['message', 'detail', 'code'].includes(field))
    .map(([field, fieldValue]) => {
      const message = toMessage(fieldValue);
      if (!message) return '';
      return `${humanizeField(field)}: ${message}`;
    })
    .filter(Boolean)
    .join(' ');
}

function toMessage(value: unknown): string {
  if (!value) return '';
  if (Array.isArray(value)) return value.map(toMessage).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map(toMessage)
      .filter(Boolean)
      .join(' ');
  }
  return String(value);
}

function humanizeField(field: string): string {
  return field
    .replace(/\./g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
