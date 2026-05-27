import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppCurrencyPipe } from '@shared/public-api';
import { Product } from '../../models';
import { AppStateService } from '../../services/app-state.service';
import { MobileQuantityStepperComponent } from '../mobile-quantity-stepper/mobile-quantity-stepper.component';

@Component({
  selector: 'fd-mobile-product-card',
  standalone: true,
  imports: [RouterLink, AppCurrencyPipe, MobileQuantityStepperComponent],
  templateUrl: './mobile-product-card.component.html',
  styleUrls: ['./mobile-product-card.component.scss'],
})
export class MobileProductCardComponent {
  @Input({ required: true }) product!: Product;
  @Input() layout: 'grid' | 'row' = 'grid';

  constructor(public state: AppStateService) {}

  quantity(): number {
    return this.state.cart().find((item) => item.id === this.product.id)?.quantity ?? 0;
  }
}
