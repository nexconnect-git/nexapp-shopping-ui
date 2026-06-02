import { Component, computed, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppCurrencyPipe } from '@shared/lib/pipes/currency.pipe';
import { AppStateService } from '../../services/app-state.service';

@Component({
  selector: 'fd-mobile-sticky-cart-bar',
  standalone: true,
  imports: [RouterLink, AppCurrencyPipe],
  templateUrl: './mobile-sticky-cart-bar.component.html',
  styleUrls: ['./mobile-sticky-cart-bar.component.scss'],
})
export class MobileStickyCartBarComponent {
  @Input() visible = true;
  savings = computed(() => Math.max(0, this.state.discount()));

  constructor(public state: AppStateService) {}
}
