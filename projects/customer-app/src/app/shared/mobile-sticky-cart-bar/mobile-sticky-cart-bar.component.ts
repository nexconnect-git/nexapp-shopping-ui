import { Component, computed, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppCurrencyPipe } from '@shared/lib/pipes/currency.pipe';
import { CustomerCartFacade } from '../../services/facades/customer-cart.facade';

@Component({
  selector: 'fd-mobile-sticky-cart-bar',
  standalone: true,
  imports: [RouterLink, AppCurrencyPipe],
  templateUrl: './mobile-sticky-cart-bar.component.html',
  styleUrls: ['./mobile-sticky-cart-bar.component.scss'],
})
export class MobileStickyCartBarComponent {
  @Input() visible = true;
  savings = computed(() => Math.max(0, this.cart.discount()));

  constructor(public cart: CustomerCartFacade) {}
}
