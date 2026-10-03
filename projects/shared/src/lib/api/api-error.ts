export interface ApiErrorBody {
  code?: string;
  detail?: string;
  message?: string;
  errors?: Record<string, unknown>;
}

export function apiErrorMessage(error: unknown, fallback = 'Request failed'): string {
  // An empty HTTP body is a transport failure, not a field-error object.
  // Never stringify HttpErrorResponse headers, functions or an HTML error page.
  const httpFailure = error !== null && typeof error === 'object' &&
    'status' in error && 'error' in error;
  const body = httpFailure ? (error as { error: unknown }).error : error;
  if (typeof body === 'string') {
    const message = body.trim();
    return message && !message.startsWith('<') ? message : fallback;
  }
  if (!body || typeof body !== 'object') return fallback;
  const response = body as ApiErrorBody;
  if (typeof response.detail === 'string' && response.detail) return response.detail;
  if (typeof response.message === 'string' && response.message) return response.message;
  const fieldMessage = formatFieldErrors(body);
  return fieldMessage || fallback;
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
  if (typeof value === 'function') return '';
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
