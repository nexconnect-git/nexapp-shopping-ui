import { Pipe, PipeTransform, inject } from '@angular/core';
import { CurrencyService } from '@shared/lib/services/currency.service';

@Pipe({name:'appCurrency',standalone:true,pure:false})
export class CustomerCurrencyPipe implements PipeTransform {
  private readonly currency = inject(CurrencyService);
  transform(value: number | string | null | undefined, symbolOnly = false): string {
    if(symbolOnly) return this.currency.getSymbol();
    if(value === null || value === undefined || String(value).trim() === '') return '—';
    const amount = Number(value);
    if(!Number.isFinite(amount)) return '—';
    const config = this.currency.config();
    const formatter = new Intl.NumberFormat(config.locale,{style:'currency',currency:config.code});
    return new Intl.NumberFormat(config.locale,{style:'currency',currency:config.code,minimumFractionDigits:Number.isInteger(amount) ? 0 : formatter.resolvedOptions().maximumFractionDigits,maximumFractionDigits:formatter.resolvedOptions().maximumFractionDigits}).format(amount);
  }
}
