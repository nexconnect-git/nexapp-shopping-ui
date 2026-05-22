import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, AppCurrencyPipe } from '@shared/public-api';
import { AppStateService } from '../../services/app-state.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { CatalogService } from '../../services/catalog.service';
import { UiService } from '../../services/ui.service';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { CustomerContentConfigService } from '../../services/customer-content-config.service';

@Component({
  standalone: true,
  imports: [
    RouterLink,
    ProductCardComponent,
    BreadcrumbsComponent,
    AppCurrencyPipe,
  ],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss'],
})
export class CartComponent {
  Math = Math;
  constructor(
    private api: ApiService,
    public state: AppStateService,
    public catalog: CatalogService,
    public ui: UiService,
    public content: CustomerContentConfigService,
  ) {}

  saveForLater(productId: string): void {
    this.api.toggleWishlist(productId).subscribe({
      next: () => this.state.showToast('Saved to wishlist'),
      error: () => this.state.showToast('Could not save item'),
    });
  }

  applyCoupon(code: string): void {
    if (!code?.trim()) {
      this.state.showToast('Enter a coupon code');
      return;
    }
    this.state.applyCoupon(code);
  }
}
