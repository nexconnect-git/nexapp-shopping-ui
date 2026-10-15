import { Component, inject, Input } from '@angular/core';
import { CustomerCurrencyPipe as AppCurrencyPipe } from '../../shared/customer-currency/customer-currency.pipe';
import { AppStateService } from '../../services/app-state.service';
@Component({
  selector: 'fd-basket-summary',
  standalone: true,
  imports: [AppCurrencyPipe],
  templateUrl: './basket-summary.component.html',
  styleUrls: ['./basket-summary.component.scss'],
})
export class BasketSummaryComponent {
  readonly state = inject(AppStateService);
  @Input() checkout = false;
}
