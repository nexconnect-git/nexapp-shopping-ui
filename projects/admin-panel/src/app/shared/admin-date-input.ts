/** Format an instant for a datetime-local input without changing its timezone. */
export function toLocalDateTimeInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
