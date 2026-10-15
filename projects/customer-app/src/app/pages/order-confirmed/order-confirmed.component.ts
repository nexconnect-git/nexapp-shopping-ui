import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerCurrencyPipe as AppCurrencyPipe } from '../../shared/customer-currency/customer-currency.pipe';
import { CustomerStateComponent } from '../../shared/customer-state/customer-state.component';
import { CustomerIconComponent } from '../../shared/customer-icon/customer-icon.component';
import { ActiveOrderSummary } from '../../models';
import { CustomerApiClientService } from '../../services/customer-api-client.service';
import { AuthService } from '../../services/auth.service';

type Confirmation = ActiveOrderSummary & {
  has_delivery_partner?: boolean;
  items_count?: number;
  remaining_items_count?: number;
  items_preview?: Array<{id:string;name:string;quantity:number;subtotal:string;image?:string|null}>;
};
@Component({
  standalone:true,
  imports:[RouterLink,AppCurrencyPipe,CustomerStateComponent,CustomerIconComponent],
  templateUrl:'./order-confirmed.component.html',
  styleUrls:['./order-confirmed.component.scss'],
})
export class OrderConfirmedComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private session = this.auth.sessionVersion;
  readonly summary = signal<Confirmation|null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  private request = 0;
  constructor(private route:ActivatedRoute,private api:CustomerApiClientService){
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(()=>this.load());
    effect(()=>{
      this.auth.currentUser();
      if(this.session===this.auth.sessionVersion)return;
      this.session=this.auth.sessionVersion;
      this.load();
    });
  }
  load():void {
    const request=++this.request;
    const session=this.auth.sessionVersion;
    this.summary.set(null);this.error.set('');this.loading.set(true);
    const id=String(this.route.snapshot.paramMap.get('id')||'').trim();
    if(!id||!this.auth.isLoggedIn()){
      this.error.set(id?'Sign in to read your order confirmation.':'This order could not be found.');
      this.loading.set(false);return;
    }
    this.api.toObservable<Confirmation>(this.api.client.orders.confirmation(id) as Promise<Confirmation>)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next:response=>{if(request!==this.request||session!==this.auth.sessionVersion)return;this.summary.set(response);this.loading.set(false);},
        error:error=>{if(request!==this.request||session!==this.auth.sessionVersion)return;this.error.set(error?.status===403?'This order is not available to your customer session.':error?.status===404?'This order could not be found.':'Do not pay again. Retry the confirmation read or check Your orders to establish the actual order status.');this.loading.set(false);},
      });
  }
  heading():string {
    return ({cancelled:'Your order was cancelled.',refunded:'Your order was refunded.',delivered:'Your good things arrived.'} as Record<string,string>)[this.summary()?.status||'']||'Your order is in.';
  }
  statusLabel():string {
    const status=this.summary()?.status||'';
    return ({placed:'Placed · waiting for the store to confirm',confirmed:'Confirmed by the store',preparing:'The store is preparing your order',ready:'Ready for delivery',assigned:'A delivery partner is assigned',picked_up:'Picked up',on_the_way:'On the way',in_transit:'On the way',delivered:'Delivered',cancelled:'Cancelled',refunded:'Refunded'} as Record<string,string>)[status]||status;
  }
  paymentLabel():string {
    const order=this.summary();
    if(order?.payment_status==='verified'||order?.payment_status==='paid')return 'Payment verified';
    if(order?.payment_status==='refunded')return 'Payment refunded';
    if(order?.payment_method==='cod')return 'Pay at delivery · UPI';
    return order?.payment_status ? 'Payment '+order.payment_status.replace(/_/g,' ') : 'Payment status unavailable';
  }
  nextStatus():string {
    const order=this.summary();
    if(order?.status==='cancelled'||order?.status==='refunded')return 'Preparation and tracking updates have stopped. Payment and refund outcomes follow the saved payment record.';
    if(order?.status==='delivered')return 'Delivery is recorded. You can find the receipt and any saved feedback in your order details.';
    return order?.has_delivery_partner ? 'A delivery partner is assigned. Follow the saved pickup and delivery status in tracking.' : 'A delivery partner has not been assigned yet. Store preparation and partner assignment happen in separate steps.';
  }
}
