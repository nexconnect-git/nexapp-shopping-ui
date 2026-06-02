import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppCurrencyPipe } from '@shared/lib/pipes/currency.pipe';
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
  readonly placeholderImage = '/assets/placeholders/product.svg';

  constructor(public state: AppStateService) {}

  quantity(): number {
    return this.state.cart().find((item) => item.id === this.product.id)?.quantity ?? 0;
  }

  storeClosed(): boolean {
    const vendor = (this.product?.raw as any)?.vendor;
    return vendor ? (vendor?.is_open_now ?? vendor?.is_open) === false : false;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
    if (img.src.includes(this.placeholderImage)) return;
    img.src = this.placeholderImage;
  }
}
