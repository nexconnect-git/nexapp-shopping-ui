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
  vendorRating = signal(5);
  deliveryRating = signal(5);
  vendorComment = signal('');
  deliveryComment = signal('');
  coupons = signal<any[]>([]);
  invoiceDownloading = signal(false);
  ratingSubmitting = signal(false);
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
    if (this.vendorRating() >= 5) return 'Excellent';
    if (this.vendorRating() >= 4) return 'Good';
    if (this.vendorRating() >= 3) return 'Okay';
    return 'Needs improvement';
  }

  submitRating(): void {
    if (this.ratingSubmitting()) return;
    if ((this.order().raw as any)?.has_rating) {
      this.state.showToast('You already reviewed this order', 'info');
      return;
    }
    this.ratingSubmitting.set(true);
    this.orders
      .submitRating(this.order().id, {
        vendor_rating: this.vendorRating(),
        vendor_comment: this.vendorComment().trim(),
        delivery_rating: this.hasDeliveryPartner()
          ? this.deliveryRating()
          : undefined,
        delivery_comment: this.hasDeliveryPartner()
          ? this.deliveryComment().trim()
          : undefined,
      })
      .subscribe({
        next: () => {
          this.state.showToast('Thanks for sharing your review', 'success');
          const raw = this.order().raw as any;
          if (raw) raw.has_rating = true;
          this.ratingSubmitting.set(false);
        },
        error: () => {
          this.state.showToast('Could not submit rating', 'error');
          this.ratingSubmitting.set(false);
        },
      });
  }

  hasDeliveryPartner(): boolean {
    return Boolean((this.order().raw as any)?.delivery_partner_info);
  }

  downloadInvoice(): void {
    if (this.invoiceDownloading()) return;
    const order = this.order();
    const orderId = String(order?.id || '');
    if (!orderId || orderId === 'loading') {
      this.state.showToast('Order details are still loading', 'info');
      return;
    }

    const knownInvoiceId = String((order.raw as any)?.invoice_id || '').trim();
    this.invoiceDownloading.set(true);
    this.state.showToast('Preparing your invoice', 'info');

    const downloadById = (invoiceId: string): void => {
      this.api.downloadInvoice(invoiceId).subscribe({
        next: (blob) => {
          this.triggerFileDownload(
            blob,
            `receipt-${(order.raw as any)?.order_number || orderId}.pdf`,
          );
          this.state.showToast('Invoice downloaded', 'success');
          this.invoiceDownloading.set(false);
        },
        error: () => {
          this.state.showToast('Could not download invoice right now', 'error');
          this.invoiceDownloading.set(false);
        },
      });
    };

    if (knownInvoiceId) {
      downloadById(knownInvoiceId);
      return;
    }

    this.api
      .generateInvoice({ order: orderId, invoice_type: 'customer_receipt' })
      .subscribe({
        next: (invoice) => {
          const invoiceId = String(invoice?.id || '').trim();
          if (!invoiceId) {
            this.state.showToast('Invoice is not ready yet', 'warning');
            this.invoiceDownloading.set(false);
            return;
          }
          downloadById(invoiceId);
        },
        error: () => {
          this.state.showToast('Could not prepare invoice right now', 'error');
          this.invoiceDownloading.set(false);
        },
      });
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
      this.state.showToast('No coupon available right now', 'warning');
      return;
    }
    navigator.clipboard?.writeText(code);
    this.state.showToast(`Coupon ${code} copied`, 'success');
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

  private triggerFileDownload(blob: Blob, fileName: string): void {
    const safeName = String(fileName || 'invoice.pdf').replace(/[^\w.-]+/g, '_');
    const link = document.createElement('a');
    const objectUrl = window.URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = safeName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
  }
}
