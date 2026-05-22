import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppCurrencyPipe } from '@shared/public-api';
import { Product } from '../../models';
import { AppStateService } from '../../services/app-state.service';

@Component({
  selector: 'fd-product-card',
  standalone: true,
  imports: [RouterLink, AppCurrencyPipe],
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss'],
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;
  @Input() compact = false;

  constructor(public state: AppStateService) {}

  quantity(): number {
    return (
      this.state.cart().find((item) => item.id === this.product.id)?.quantity ??
      0
    );
  }
}
