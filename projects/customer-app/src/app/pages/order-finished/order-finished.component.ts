import { Component, computed, effect, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ApiService,
  AppCurrencyPipe,
  AuthService as SharedAuthService,
} from '@shared/public-api';
import { OrderService } from '../../services/order.service';
import { AppStateService } from '../../services/app-state.service';
import { DisplayOrderIdPipe } from '../../shared/display-order-id.pipe';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';

@Component({
  standalone: true,
  imports: [
    AppCurrencyPipe,
    RouterLink,
    BreadcrumbsComponent,
    DisplayOrderIdPipe,
  ],
  templateUrl: './order-finished.component.html',
  styleUrls: ['./order-finished.component.scss'],
})
export class OrderFinishedComponent {
  rating = signal(5);
  coupons = signal<any[]>([]);
  private couponsLoaded = false;

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private auth: SharedAuthService,
    public orders: OrderService,
    public state: AppStateService,
  ) {
    effect(() => {
      if (!this.auth.isLoggedIn()) {
        this.couponsLoaded = false;
        this.coupons.set([]);
        return;
      }
      if (this.couponsLoaded) return;
      this.couponsLoaded = true;
      this.api.getCoupons().subscribe({
        next: (response) => this.coupons.set(this.unwrap(response)),
        error: () => this.coupons.set([]),
      });
    });
  }

  order = computed(() =>
    this.orders.getOrder(this.route.snapshot.paramMap.get('id')),
  );
  steps = computed(() => {
    const order = this.order();
    const tracking =
      (order.raw as any)?.tracking || (order.raw as any)?.status_history || [];
    if (Array.isArray(tracking) && tracking.length) {
      return tracking.map((entry: any) => ({
        title: this.labelFor(entry.status || entry.title),
        time: entry.timestamp
          ? new Date(entry.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '',
      }));
    }
    return [
      { title: 'Order Confirmed', time: order.time || '' },
      {
        title: order.status === 'Delivered' ? 'Delivered' : 'Latest status',
        time: order.status === 'Delivered' ? order.time : order.status,
      },
    ];
  });
  partnerImage = computed(
    () =>
      (this.order().raw as any)?.delivery_partner_info?.photo ||
      (this.order().raw as any)?.delivery_partner_info?.avatar ||
      '',
  );
  nextCoupon = computed(() => this.coupons()[0] || null);

  ratingLabel(): string {
    if (this.rating() >= 5) return 'Excellent';
    if (this.rating() >= 4) return 'Good';
    if (this.rating() >= 3) return 'Okay';
    return 'Needs improvement';
  }

  submitRating(): void {
    this.orders.submitRating(this.order().id, this.rating());
  }

  downloadInvoice(): void {
    this.state.showToast('Invoice download started');
  }

  reorder(): void {
    this.orders.reorder(this.order());
  }

  copyCoupon(): void {
    const coupon = this.nextCoupon();
    const code = String(
      coupon?.code || coupon?.coupon_code || '',
    ).toUpperCase();
    if (!code) {
      this.state.showToast('No coupon available right now');
      return;
    }
    navigator.clipboard?.writeText(code);
    this.state.showToast(`Coupon ${code} copied`);
  }

  couponCode(coupon: any): string {
    return String(coupon?.code || coupon?.coupon_code || '').toUpperCase();
  }

  couponTitle(coupon: any): string {
    return (
      coupon?.title || coupon?.name || coupon?.description || 'Next order offer'
    );
  }

  orderFee(field: 'delivery_fee' | 'handling_fee' | 'discount_amount'): number {
    return Number((this.order().raw as any)?.[field] || 0);
  }

  private unwrap(response: any): any[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.results)) return response.results;
    if (Array.isArray(response?.coupons)) return response.coupons;
    return [];
  }

  private labelFor(status: string): string {
    return String(status || 'Update')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
