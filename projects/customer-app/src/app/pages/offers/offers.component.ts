import { Component, computed } from '@angular/core';
import { Offer } from '../../models';
import { AppStateService } from '../../services/app-state.service';
import { CatalogService } from '../../services/catalog.service';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { CustomerContentConfigService } from '../../services/customer-content-config.service';

@Component({
  standalone: true,
  imports: [BreadcrumbsComponent],
  templateUrl: './offers.component.html',
  styleUrls: ['./offers.component.scss'],
})
export class OffersComponent {
  offers = computed<Offer[]>(() =>
    this.catalog.topCoupons().map((coupon, index) => ({
      code: coupon.code,
      title: coupon.title,
      description: coupon.description,
      valid: coupon.validUntil
        ? `Valid till ${new Date(coupon.validUntil).toLocaleDateString()}`
        : 'Limited period',
      tone: (['red', 'purple', 'orange', 'green'] as const)[index % 4],
    })),
  );
  heroOffer = computed(() => this.offers()[0] || null);

  constructor(
    private catalog: CatalogService,
    public state: AppStateService,
    public content: CustomerContentConfigService,
  ) {}

  apply(code: string): void {
    if (!code?.trim()) {
      this.state.showToast('Coupon code is not available');
      return;
    }
    this.state.applyCoupon(code);
  }
}
