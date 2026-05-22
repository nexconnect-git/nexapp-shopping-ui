import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'displayValue',
  standalone: true,
})
export class DisplayValuePipe implements PipeTransform {
  transform(value: unknown): string {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) {
      return value.length
        ? value
            .map((item) =>
              typeof item === 'object' ? JSON.stringify(item) : String(item),
            )
            .join(', ')
        : '-';
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
}
