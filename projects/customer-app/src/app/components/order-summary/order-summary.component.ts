import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppCurrencyPipe } from '@shared/lib/pipes/currency.pipe';
import { AppStateService } from '../../services/app-state.service';

@Component({
  selector: 'fd-order-summary',
  standalone: true,
  imports: [RouterLink, AppCurrencyPipe],
  templateUrl: './order-summary.component.html',
  styleUrls: ['./order-summary.component.scss'],
})
export class OrderSummaryComponent {
  @Input() showButton = true;
  constructor(public state: AppStateService) {}
}
