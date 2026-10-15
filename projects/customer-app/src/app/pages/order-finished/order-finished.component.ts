import { CustomerIconComponent } from '../../shared/customer-icon/customer-icon.component';
import { NxModalShellComponent } from '../../shared/ui/nx-modal-shell/nx-modal-shell.component';
import { CustomerReceiptComponent } from '../../shared/customer-receipt/customer-receipt.component';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerCurrencyPipe as AppCurrencyPipe } from '../../shared/customer-currency/customer-currency.pipe';
import { AuthService as SharedAuthService } from '@shared/lib/services/auth.service';
import { OrderService } from '../../services/order.service';
import { AppStateService } from '../../services/app-state.service';
import { DisplayOrderIdPipe } from '../../shared/display-order-id.pipe';
import { CustomerStateComponent } from '../../shared/customer-state/customer-state.component';
import { FormsModule } from '@angular/forms';
import { CustomerOrderApiService } from '../../services/customer-order-api.service';

@Component({
  standalone: true,
  imports: [CustomerIconComponent, NxModalShellComponent, CustomerReceiptComponent,
    AppCurrencyPipe,
    RouterLink,
    CustomerStateComponent,
    FormsModule,
    DisplayOrderIdPipe,
  ],
  templateUrl: './order-finished.component.html',
  styleUrls: ['./order-finished.component.scss'],
})
export class OrderFinishedComponent {
  private readonly destroyRef = inject(DestroyRef);
  readonly ratingOpen = signal(false);
  readonly receiptOpen = signal(false);
  readonly knownInvoiceId = computed(() => String((this.order().raw as any)?.invoice_id || ''));
  private authSession = -1;
  readonly storeName = computed(() => this.order().raw?.vendor_name || this.order().raw?.vendor_info?.store_name || 'Store');
  readonly timeline = computed(() => (this.order().raw?.tracking || []).map((event:any) => ({status:String(event.status || '').replace(/_/g,' '),time:event.timestamp ? new Date(event.timestamp).toLocaleString() : 'Time unavailable'})));
  private readonly routeParams = toSignal(this.route.paramMap);
  vendorRating = signal(0);
  deliveryRating = signal(0);
  vendorComment = signal('');
  deliveryComment = signal('');
  coupons = signal<any[]>([]);
  receiptError = signal('');
  ratingSubmitting = signal(false);
  ratingError = signal('');
  ratingSaved = signal(false);
  readonly stars = [1, 2, 3, 4, 5];
  detailError = computed(
    () => this.orders.detailErrors()[this.routeParams()?.get('id') || ''] || ''
  );
  delivered = computed(() => this.order().raw?.status === 'delivered');
  alreadyRated = computed(
    () => this.ratingSaved() || !!this.order().raw?.has_rating
  );
  deliveredAt = computed(() => {
    const value =
      this.order().raw?.actual_delivery_time ||
      this.order().raw?.tracking?.find(
        (entry: any) => entry.status === 'delivered'
      )?.timestamp;
    return value
      ? new Date(value).toLocaleString()
      : 'Delivery time unavailable';
  });
  retry(): void {
    this.orders.refreshOrder(this.routeParams()?.get('id') || '');
  }

  constructor(
    private route: ActivatedRoute,
    private orderApi: CustomerOrderApiService,
    private auth: SharedAuthService,
    public orders: OrderService,
    public state: AppStateService
  ) {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.vendorRating.set(0);
      this.deliveryRating.set(0);
      this.vendorComment.set('');
      this.deliveryComment.set('');
      this.ratingSaved.set(false);
      this.ratingOpen.set(false);this.receiptOpen.set(false);this.receiptError.set('');
      this.ratingError.set('');
      this.orders.refreshOrder(params.get('id') || '');
    });
    effect(() => {
      this.auth.user();
      if(this.authSession===this.auth.sessionVersion)return;
      this.authSession=this.auth.sessionVersion;
      this.ratingOpen.set(false);this.receiptOpen.set(false);this.ratingSubmitting.set(false);
      this.vendorRating.set(0);this.deliveryRating.set(0);this.vendorComment.set('');this.deliveryComment.set('');this.ratingError.set('');this.ratingSaved.set(false);
      this.coupons.set([]);
      if(!this.auth.isLoggedIn())return;
      const session=this.auth.sessionVersion;
      this.orderApi.getCoupons().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next:response=>{if(session===this.auth.sessionVersion)this.coupons.set(this.unwrap(response));},
        error:()=>{if(session===this.auth.sessionVersion)this.coupons.set([]);},
      });
    });
  }

  order = computed(() =>
    this.orders.getOrder(this.routeParams()?.get('id') || null)
  );
  partnerImage = computed(
    () =>
      (this.order().raw as any)?.delivery_partner_info?.photo ||
      (this.order().raw as any)?.delivery_partner_info?.avatar ||
      ''
  );
  nextCoupon = computed(() => this.coupons()[0] || null);

  itemUnit(item: any): string {
    return item.raw?.product_unit || item.raw?.unit || 'item';
  }
  itemQuantity(item: any): number {
    const quantity=Number(item.raw?.quantity ?? item.quantity);
    return Number.isFinite(quantity) && quantity>0 ? quantity : 0;
  }
  ratingLabel(): string {
    if (this.vendorRating() >= 5) return 'Excellent';
    if (this.vendorRating() >= 4) return 'Good';
    if (this.vendorRating() >= 3) return 'Okay';
    return 'Needs improvement';
  }

  submitRating(event?: Event): void {
    if (this.ratingSubmitting()) return;
    this.ratingError.set('');
    if (!this.delivered()) {
      this.ratingError.set('Only delivered orders can be rated.');
      return;
    }
    if (
      !this.vendorRating() ||
      (this.hasDeliveryPartner() && !this.deliveryRating())
    ) {
      this.ratingError.set(
        'Choose a rating for the store' +
          (this.hasDeliveryPartner() ? ' and delivery partner.' : '.')
      );
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>('[aria-label="Rate the store"] button')
          ?.focus()
      );
      return;
    }
    if (this.alreadyRated()) {
      this.state.showToast('You already reviewed this order', 'info');
      return;
    }
    const session=this.auth.sessionVersion,id=this.order().id;
    const retryTrigger = event?.currentTarget instanceof HTMLElement
      ? event.currentTarget : document.querySelector<HTMLElement>('#rating-submit');
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
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          if(session!==this.auth.sessionVersion || id!==this.routeParams()?.get('id'))return;
          this.state.showToast('Thanks for sharing your review', 'success');
          this.ratingSaved.set(true);this.ratingOpen.set(false);
          this.retry();
          this.ratingSubmitting.set(false);
        },
        error: (error) => {
          if(session!==this.auth.sessionVersion || id!==this.routeParams()?.get('id'))return;
          this.ratingError.set(
            error.body?.error ||
              error.error?.error ||
              'Your review could not be saved. Your ratings are kept here for retry.'
          );
          this.ratingSubmitting.set(false);
          requestAnimationFrame(() => {
            if (session === this.auth.sessionVersion && id === this.routeParams()?.get('id') && this.ratingOpen() && retryTrigger?.isConnected) retryTrigger.focus();
          });
        },
      });
  }

  hasDeliveryPartner(): boolean {
    return Boolean((this.order().raw as any)?.delivery_partner_info);
  }

  downloadInvoice():void {
    if(this.order().id==='loading'||!this.auth.isLoggedIn())return;
    this.receiptError.set('');this.receiptOpen.set(true);
  }
  receiptDownloaded():void {this.state.showToast('Receipt downloaded','success');}
  receiptFailed(message:string):void {
    this.receiptError.set(message);
    this.receiptOpen.set(false);
  }
  itemSubtotal(item:any):number|string|null {
    if(item.raw?.subtotal!==undefined&&item.raw?.subtotal!==null)return item.raw.subtotal;
    return this.itemQuantity(item)>0 ? item.price*this.itemQuantity(item) : null;
  }

  reorder(): void {
    this.orders.reorder(this.order());
  }

  async copyCoupon(): Promise<void> {
    const coupon = this.nextCoupon();
    const code = String(
      coupon?.code || coupon?.coupon_code || ''
    ).toUpperCase();
    if (!code) {
      this.state.showToast('No coupon available right now', 'warning');
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      this.state.showToast(`Coupon ${code} copied`, 'success');
    } catch {
      this.state.showToast(
        'Could not copy this code. You can select and copy it manually.',
        'warning'
      );
    }
  }

  couponCode(coupon: any): string {
    return String(coupon?.code || coupon?.coupon_code || '').toUpperCase();
  }

  couponTitle(coupon: any): string {
    return (
      coupon?.title || coupon?.name || coupon?.description || 'Next order offer'
    );
  }

  private unwrap(response: any): any[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.results)) return response.results;
    if (Array.isArray(response?.coupons)) return response.coupons;
    return [];
  }

}
