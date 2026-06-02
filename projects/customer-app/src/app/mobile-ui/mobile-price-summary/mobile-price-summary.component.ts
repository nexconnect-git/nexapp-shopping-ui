import { Component } from '@angular/core';
import { AppCurrencyPipe } from '@shared/lib/pipes/currency.pipe';
import { AppStateService } from '../../services/app-state.service';

@Component({
  selector: 'fd-mobile-price-summary',
  standalone: true,
  imports: [AppCurrencyPipe],
  templateUrl: './mobile-price-summary.component.html',
  styleUrls: ['./mobile-price-summary.component.scss'],
})
export class MobilePriceSummaryComponent {
  constructor(public state: AppStateService) {}
}
