import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, TitleCasePipe, SlicePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, AppCurrencyPipe, Cart, Address, ToastService } from '@shared/public-api';
import { AddressModalComponent } from './address-modal/address-modal.component';

declare const Razorpay: any;

interface PaymentMethod {
  id: string;
  label: string;
  icon: string;
  sub?: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, AppCurrencyPipe, RouterLink, TitleCasePipe, SlicePipe, AddressModalComponent],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss'
})
export class CheckoutComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);

  cart = signal<Cart | null>(null);
  addresses = signal<Address[]>([]);
  loading = signal(true);
  placingOrder = signal(false);
  orderError = signal('');

  selectedAddressId: string | null = null;
  selectedPayment = 'cod';
  notes = '';
  showAddressModal = signal(false);

  couponCode = '';
  appliedCoupon = signal<any>(null);
  couponError = signal('');
  couponLoading = signal(false);

  deliveryFeePreview = signal<any>(null);
  deliveryFeeLoading = signal(false);

  walletBalance = signal<number>(0);
  walletAmountToUse = signal<number>(0);
  walletLoading = signal(false);

  readonly paymentMethods: PaymentMethod[] = [
    { id: 'cod',      label: 'Pay on Delivery',        icon: 'payments',               sub: 'Pay cash to delivery partner' },
    { id: 'razorpay', label: 'Pay Online (Razorpay)',  icon: 'account_balance_wallet',  sub: 'UPI, Cards, Net Banking & more' },
  ];

  ngOnInit() {
    this.api.getCart().subscribe({
      next: (c) => { this.cart.set(c); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
    this.api.getAddresses().subscribe({
      next: (r) => {
        const addrs: Address[] = r.results || r;
        this.addresses.set(addrs);
        const def = addrs.find(a => a.is_default);
        if (def) this.selectedAddressId = def.id;
        else if (addrs.length) this.selectedAddressId = addrs[0].id;
        if (this.selectedAddressId) this.fetchDeliveryFeePreview(this.selectedAddressId);
      }
    });
    this.walletLoading.set(true);
    this.api.getWallet().subscribe({
      next: (w) => { this.walletBalance.set(Number(w.balance)); this.walletLoading.set(false); },
      error: () => this.walletLoading.set(false),
    });
  }

  get maxWalletApplicable(): number {
    return Math.min(this.walletBalance(), this.discountedTotal);
  }

  applyFullWallet() {
    this.walletAmountToUse.set(this.maxWalletApplicable);
  }

  get finalTotal(): number {
    return Math.max(this.discountedTotal - this.walletAmountToUse(), 0);
  }

  selectAddress(id: string) {
    this.selectedAddressId = id;
    this.fetchDeliveryFeePreview(id);
  }

  fetchDeliveryFeePreview(addressId: string) {
    this.deliveryFeeLoading.set(true);
    this.api.getDeliveryFeePreview(addressId).subscribe({
      next: (res) => { this.deliveryFeePreview.set(res); this.deliveryFeeLoading.set(false); },
      error: () => this.deliveryFeeLoading.set(false),
    });
  }

  get selectedAddress(): Address | undefined {
    return this.addresses().find(a => a.id === this.selectedAddressId);
  }

  get deliveryFee(): number {
    const preview = this.deliveryFeePreview();
    return preview ? +preview.total_delivery_fee : 0;
  }

  get discountedTotal(): number {
    const total = Number(this.cart()?.total_amount || 0);
    const discount = Number(this.appliedCoupon()?.discount || 0);
    return Math.max(total + this.deliveryFee - discount, 0);
  }

  applyCoupon() {
    const code = this.couponCode.trim().toUpperCase();
    if (!code) return;
    this.couponLoading.set(true);
    this.couponError.set('');
    this.api.validateCoupon(code, Number(this.cart()?.total_amount || 0)).subscribe({
      next: (res) => { this.appliedCoupon.set(res); this.couponLoading.set(false); },
      error: (err) => {
        this.couponError.set(err.error?.error || 'Invalid coupon.');
        this.appliedCoupon.set(null);
        this.couponLoading.set(false);
      }
    });
  }

  removeCoupon() {
    this.appliedCoupon.set(null);
    this.couponCode = '';
    this.couponError.set('');
  }

  // Dialog shown when Razorpay payment fails or is dismissed
  showPaymentFailedDialog = signal(false);
  paymentFailedMsg = signal('');
  // Pending Razorpay order ID so we can retry without re-initiating
  private pendingRzOrderId = '';
  private pendingRzAmount = 0;
  private pendingRzCurrency = 'INR';

  placeOrder() {
    if (!this.selectedAddressId) return;
    this.placingOrder.set(true);
    this.orderError.set('');

    if (this.selectedPayment === 'razorpay' && this.finalTotal > 0) {
      // New flow: initiate Razorpay order first, then create app order after payment
      this.api.initiateCheckoutPayment({
        delivery_address_id: this.selectedAddressId,
        coupon_code: this.appliedCoupon()?.code,
        wallet_amount: this.walletAmountToUse() || undefined,
      }).subscribe({
        next: (rzData) => {
          this.pendingRzOrderId = rzData.razorpay_order_id;
          this.pendingRzAmount = rzData.amount;
          this.pendingRzCurrency = rzData.currency;
          this.openRazorpayModal(rzData);
        },
        error: (err) => this.handleOrderError(err.error?.error || 'Could not initiate payment.'),
      });
    } else {
      // COD or wallet-fully-covered
      this.submitOrder(null);
    }
  }

  private openRazorpayModal(rzData: { key_id: string; razorpay_order_id: string; amount: number; currency: string }) {
    const options = {
      key: rzData.key_id,
      amount: rzData.amount,
      currency: rzData.currency,
      name: 'NexConnect',
      description: 'Order Payment',
      order_id: rzData.razorpay_order_id,
      prefill: {},
      theme: { color: '#6C63FF' },
      handler: (response: any) => {
        // Payment succeeded — create app order with proof
        this.placingOrder.set(true);
        this.submitOrder({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () => {
          this.placingOrder.set(false);
          this.paymentFailedMsg.set('You closed the payment window before completing payment.');
          this.showPaymentFailedDialog.set(true);
        }
      }
    };
    const rzp = new Razorpay(options);
    rzp.on('payment.failed', (response: any) => {
      this.placingOrder.set(false);
      this.paymentFailedMsg.set(response.error?.description || 'Payment was declined by your bank.');
      this.showPaymentFailedDialog.set(true);
    });
    this.placingOrder.set(false);
    rzp.open();
  }

  retryPayment() {
    this.showPaymentFailedDialog.set(false);
    if (!this.pendingRzOrderId) { this.placeOrder(); return; }
    // Re-open Razorpay with the same order (no need to call initiate again)
    this.openRazorpayModal({
      key_id: '',  // will be fetched below
      razorpay_order_id: this.pendingRzOrderId,
      amount: this.pendingRzAmount,
      currency: this.pendingRzCurrency,
    });
    // Re-initiate to get key_id (needed by Razorpay SDK)
    this.placingOrder.set(true);
    this.api.initiateCheckoutPayment({
      delivery_address_id: this.selectedAddressId!,
      coupon_code: this.appliedCoupon()?.code,
      wallet_amount: this.walletAmountToUse() || undefined,
    }).subscribe({
      next: (rzData) => {
        this.pendingRzOrderId = rzData.razorpay_order_id;
        this.pendingRzAmount = rzData.amount;
        this.openRazorpayModal(rzData);
      },
      error: (err) => this.handleOrderError(err.error?.error || 'Could not initiate payment.'),
    });
  }

  placeOrderPayLater() {
    this.showPaymentFailedDialog.set(false);
    this.placingOrder.set(true);
    this.submitOrder(null);  // creates order with payment_method=razorpay but is_payment_verified=false
  }

  dismissPaymentDialog() {
    this.showPaymentFailedDialog.set(false);
    this.placingOrder.set(false);
  }

  private submitOrder(paymentProof: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string } | null) {
    const orderData: any = {
      delivery_address_id: this.selectedAddressId,
      payment_method: this.selectedPayment,
      notes: this.notes,
    };
    if (this.appliedCoupon()) orderData.coupon_code = this.appliedCoupon().code;
    if (this.walletAmountToUse() > 0) orderData.wallet_amount = this.walletAmountToUse();
    if (this.scheduledFor()) orderData.scheduled_for = this.scheduledFor();
    if (paymentProof) Object.assign(orderData, paymentProof);

    this.api.createOrder(orderData).subscribe({
      next: (orders) => {
        this.api.refreshCartCount();
        const orderId = Array.isArray(orders) ? orders[0]?.id : orders?.id;
        if (!orderId) { this.handleOrderError('Order created but ID missing.'); return; }
        if (!paymentProof && this.selectedPayment === 'razorpay') {
          this.toast.show('Order placed. Complete payment from Order Details.', 'info');
        }
        setTimeout(() => this.router.navigate(['/order', orderId]), 300);
      },
      error: (err) => {
        this.handleOrderError(err.error?.detail || err.error?.non_field_errors?.[0] || 'Could not place order.');
      }
    });
  }

  private handleOrderError(msg: string) {
    this.orderError.set(msg);
    this.placingOrder.set(false);
  }

  readonly Math = Math;

  // Scheduling
  scheduledFor = signal<string>('');  // ISO datetime string or ''

  get scheduledForDate(): string {
    const v = this.scheduledFor();
    return v ? v.split('T')[0] : '';
  }

  get scheduledForTime(): string {
    const v = this.scheduledFor();
    return v ? v.split('T')[1]?.slice(0, 5) : '';
  }

  setScheduledDate(date: string) {
    const time = this.scheduledForTime || '12:00';
    this.scheduledFor.set(date ? `${date}T${time}` : '');
  }

  setScheduledTime(time: string) {
    const date = this.scheduledForDate || new Date().toISOString().split('T')[0];
    this.scheduledFor.set(time ? `${date}T${time}` : '');
  }

  get minScheduleDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  onAddressCreated(addr: Address) {
    this.addresses.update(list => [...list, addr]);
    this.selectAddress(addr.id);
    this.showAddressModal.set(false);
  }

  goBack() { window.history.back(); }
}
