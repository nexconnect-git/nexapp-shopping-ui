import { CustomerIconComponent } from '../../shared/customer-icon/customer-icon.component';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerCurrencyPipe as AppCurrencyPipe } from '../../shared/customer-currency/customer-currency.pipe';
import { AppStateService } from '../../services/app-state.service';
@Component({
  selector: 'fd-basket-items',
  standalone: true,
  imports: [CustomerIconComponent,RouterLink, AppCurrencyPipe],
  templateUrl: './basket-items.component.html',
  styleUrls: ['./basket-items.component.scss'],
})
export class BasketItemsComponent {
  readonly state = inject(AppStateService);
}
