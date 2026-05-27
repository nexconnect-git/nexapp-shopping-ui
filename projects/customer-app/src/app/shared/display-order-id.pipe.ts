import { Pipe, PipeTransform } from '@angular/core';

export function displayOrderId(orderOrId: unknown): string {
  const raw =
    typeof orderOrId === 'object' && orderOrId !== null
      ? (orderOrId as any)
      : null;
  const value =
    raw?.raw?.order_number ||
    raw?.order_number ||
    raw?.display_id ||
    raw?.number ||
    raw?.id ||
    orderOrId;
  const text = String(value || '').trim();
  if (!text) return 'NT-PENDING';
  if (/^ORD[-_]/i.test(text)) return text.toUpperCase().replace(/_/g, '-');
  if (/^[0-9]+$/.test(text)) return `NT-${text}`;
  const uuid = text.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-([0-9a-f]{12})/i,
  );
  if (uuid) return `NT-${uuid[1].slice(0, 6).toUpperCase()}`;
  return text.length > 14
    ? `NT-${text
        .replace(/[^a-z0-9]/gi, '')
        .slice(-6)
        .toUpperCase()}`
    : text.toUpperCase();
}

@Pipe({
  name: 'displayOrderId',
  standalone: true,
})
export class DisplayOrderIdPipe implements PipeTransform {
  transform(orderOrId: unknown): string {
    return displayOrderId(orderOrId);
  }
}
