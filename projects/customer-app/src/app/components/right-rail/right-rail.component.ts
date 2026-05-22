import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CustomerCoupon } from '../../models';
import { AppStateService } from '../../services/app-state.service';
import { CatalogService } from '../../services/catalog.service';

@Component({
  selector: 'fd-right-rail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './right-rail.component.html',
  styleUrls: ['./right-rail.component.scss'],
})
export class RightRailComponent {
  readonly topCoupon = computed(() => this.catalog.topCoupons()[0] || null);
  readonly promoBanners = computed(() => this.catalog.banners().slice(1, 3));
  readonly featuredProducts = computed(() => {
    const recommended = this.catalog.recommendedProducts();
    if (recommended.length) return recommended.slice(0, 3);
    const discounted = this.catalog
      .products()
      .filter((product) => !!product.discount);
    return (discounted.length ? discounted : this.catalog.products()).slice(
      0,
      3,
    );
  });

  constructor(
    public state: AppStateService,
    public catalog: CatalogService,
  ) {}

  couponCode(coupon: CustomerCoupon): string {
    return coupon.code;
  }

  couponTitle(coupon: CustomerCoupon): string {
    return coupon.title || coupon.badgeText || 'Available offer';
  }

  couponDescription(coupon: CustomerCoupon): string {
    return coupon.description || 'Apply this offer at checkout';
  }

  applyCoupon(coupon: CustomerCoupon): void {
    const code = this.couponCode(coupon);
    if (!code) {
      this.state.showToast('Coupon code is not available');
      return;
    }
    this.state.applyCoupon(code);
  }
}
