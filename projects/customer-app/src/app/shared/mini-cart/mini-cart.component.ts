import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppCurrencyPipe } from '@shared/lib/pipes/currency.pipe';
import { AppStateService } from '../../services/app-state.service';
import { UiService } from '../../services/ui.service';
import { CustomerContentConfigService } from '../../services/customer-content-config.service';

@Component({
  selector: 'fd-mini-cart',
  standalone: true,
  imports: [RouterLink, AppCurrencyPipe],
  templateUrl: './mini-cart.component.html',
  styleUrls: ['./mini-cart.component.scss'],
})
export class MiniCartComponent {
  constructor(
    public state: AppStateService,
    public ui: UiService,
    public content: CustomerContentConfigService,
  ) {}

  close(): void {
    this.state.closeMiniCart();
    this.ui.closeMiniCart();
  }
}
