import { Pipe, type PipeTransform } from '@angular/core';
import { CurrencyService } from '../services/currency.service';

@Pipe({ name: 'appCurrency', standalone: true, pure: false })
export class AppCurrencyPipe implements PipeTransform {
  constructor(private readonly currency: CurrencyService) {}

  transform(value: number | string | null, symbolOnly = false): string {
    if (symbolOnly) return this.currency.getSymbol();
    return this.currency.format(value);
  }
}
