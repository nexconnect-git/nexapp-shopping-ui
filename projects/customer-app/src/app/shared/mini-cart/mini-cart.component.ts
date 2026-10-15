import { CustomerIconComponent } from '../customer-icon/customer-icon.component';
import { NxModalShellComponent } from '../ui/nx-modal-shell/nx-modal-shell.component';
import { CustomerStateComponent } from '../customer-state/customer-state.component';
import { AuthService } from '../../services/auth.service';
import { BasketItemsComponent } from '../../components/basket-items/basket-items.component';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerCurrencyPipe as AppCurrencyPipe } from '../customer-currency/customer-currency.pipe';
import { AppStateService } from '../../services/app-state.service';
import { UiService } from '../../services/ui.service';

@Component({
  selector: 'fd-mini-cart',
  standalone: true,
  imports: [CustomerIconComponent,
    RouterLink,
    AppCurrencyPipe,
    NxModalShellComponent,
    CustomerStateComponent,
    BasketItemsComponent,
  ],
  templateUrl: './mini-cart.component.html',
  styleUrls: ['./mini-cart.component.scss'],
})
export class MiniCartComponent {
  constructor(
    public state: AppStateService,
    public ui: UiService,
    public auth: AuthService
  ) {}

  close(): void {
    this.state.closeMiniCart();
    this.ui.closeMiniCart();
  }

  checkout(): void {
    if (this.state.proceedToCheckout()) this.close();
  }
}
