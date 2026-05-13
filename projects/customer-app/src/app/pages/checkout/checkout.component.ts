import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AddressModalComponent } from './address-modal/address-modal.component';
import { Address, AlertService, ApiService, AppCurrencyPipe, Cart, DeliveryFeePreview } from '@shared/public-api';

declare const Razorpay: any;

interface PaymentMethod {
  id: string;
  label: string;
  icon: string;
  sub?: string;
  disabled?: boolean;
}

const DEFAULT_ENABLED_PAYMENT_METHODS = ['razorpay_upi', 'razorpay_card', 'razorpay_wallet', 'razorpay_netbanking', 'cod'];
const ONLINE_PAYMENT_OPTIONS = [
  { key: 'razorpay_upi', label: 'UPI' },
  { key: 'razorpay_card', label: 'Cards' },
  { key: 'razorpay_wallet', label: 'Wallets' },
  { key: 'razorpay_netbanking', label: 'Net Banking' },
];

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, AppCurrencyPipe, AddressModalComponent],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss'
})
export class CheckoutComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private alerts = inject(AlertService);

  cart = signal<Cart | null>(null);
  addresses = signal<Address[]>([]);
  loading = signal(true);
  placingOrder = signal(false);
  orderError = signal('');

  selectedAddressId: string | null = null;
  selectedPayment = 'razorpay';
  enabledPaymentMethods = signal<string[]>(DEFAULT_ENABLED_PAYMENT_METHODS);
  notes = '';
  showAddressModal = signal(false);

  couponCode = '';
  appliedCoupon = signal<any>(null);
  couponError = signal('');
  couponLoading = signal(false);

  deliveryFeePreview = signal<DeliveryFeePreview | null>(null);
  deliveryFeeLoading = signal(false);
  farDeliveryConfirmed = signal(false);

  walletBalance = signal<number>(0);
  walletAmountToUse = signal<number>(0);
  walletLoading = signal(false);

  loyaltyPoints = signal<number>(0);
  loyaltyDiscount = signal<number>(0);
  loyaltyMaxRedeemable = signal<number>(0);
  useLoyalty = signal<boolean>(false);
  loyaltyLoading = signal(false);

  get paymentMethods(): PaymentMethod[] {
    const enabled = this.enabledPaymentMethods();
    const onlineLabels = ONLINE_PAYMENT_OPTIONS
      .filter(option => enabled.includes(option.key))
      .map(option => option.label);
    const methods: PaymentMethod[] = [];
    if (onlineLabels.length) {
      methods.push({
        id: 'razorpay',
        label: 'Pay Online',
        icon: 'account_balance_wallet',
        sub: onlineLabels.join(', '),
      });
    }
    if (enabled.includes('cod')) {
      methods.push({
        id: 'cod',
        label: 'Cash on Delivery',
        icon: 'payments',
        sub: 'Pay cash to delivery partner',
      });
    }
    return methods;
  }

  ngOnInit() {
    this.loadPaymentMethods();
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
    this.loyaltyLoading.set(true);
    this.api.getLoyalty().subscribe({
      next: (l) => { this.loyaltyPoints.set(l.points || 0); this.loyaltyLoading.set(false); },
      error: () => this.loyaltyLoading.set(false),
    });
  }

  private loadPaymentMethods() {
    this.api.getPaymentMethods().subscribe({
      next: (settings) => {
        const enabled = Array.isArray(settings?.enabled_payment_methods) && settings.enabled_payment_methods.length
          ? settings.enabled_payment_methods
          : DEFAULT_ENABLED_PAYMENT_METHODS;
        this.enabledPaymentMethods.set(enabled);
        this.normalizeSelectedPayment();
      },
      error: () => {
        this.enabledPaymentMethods.set(DEFAULT_ENABLED_PAYMENT_METHODS);
        this.normalizeSelectedPayment();
      },
    });
  }

  private normalizeSelectedPayment() {
    const methods = this.paymentMethods;
    if (!methods.length) return;
    if (!methods.some(method => method.id === this.selectedPayment)) {
      this.selectedPayment = methods[0].id;
    }
  }

  get maxWalletApplicable(): number {
    return Math.min(this.walletBalance(), this.discountedTotal);
  }

  applyFullWallet() {
    this.walletAmountToUse.set(this.maxWalletApplicable);
  }

  toggleLoyalty() {
    if (this.useLoyalty()) {
      this.useLoyalty.set(false);
      this.loyaltyDiscount.set(0);
      this.loyaltyMaxRedeemable.set(0);
    } else {
      const total = this.discountedTotal - this.walletAmountToUse();
      if (total <= 0 || this.loyaltyPoints() <= 0) return;
      this.api.getLoyaltyPreview(total).subscribe({
        next: (preview) => {
          this.loyaltyMaxRedeemable.set(preview.max_redeemable);
          this.loyaltyDiscount.set(Number(preview.discount));
          this.useLoyalty.set(true);
        }
      });
    }
  }

  get finalTotal(): number {
    const loyalty = this.useLoyalty() ? this.loyaltyDiscount() : 0;
    return Math.max(this.discountedTotal - this.walletAmountToUse() - loyalty, 0);
  }

  selectAddress(id: string) {
    this.selectedAddressId = id;
    this.farDeliveryConfirmed.set(false);
    this.fetchDeliveryFeePreview(id);
  }

  fetchDeliveryFeePreview(addressId: string) {
    this.deliveryFeeLoading.set(true);
    this.api.getDeliveryFeePreview(addressId).subscribe({
      next: (res) => {
        this.deliveryFeePreview.set(res);
        this.farDeliveryConfirmed.set(false);
        this.deliveryFeeLoading.set(false);
      },
      error: () => this.deliveryFeeLoading.set(false),
    });
  }

  get selectedAddress(): Address | undefined {
    return this.addresses().find(a => a.id === this.selectedAddressId);
  }

  addressLabel(addr: Address): string {
    if (addr.label === 'home') return 'Home';
    if (addr.label === 'work') return 'Work';
    return addr.landmark?.trim() || 'Other';
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
    this.api.validateCoupon(code, Number(this.cart()?.total_amount || 0), this.selectedAddressId).subscribe({
      next: (res) => { this.appliedCoupon.set(res); this.couponCode = res.code || code; this.couponLoading.set(false); },
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
    this.normalizeSelectedPayment();
    if (!this.paymentMethods.length) {
      this.handleOrderError('No payment methods are enabled right now.');
      return;
    }
    if (this.requiresFarDeliveryConfirmation() && !this.farDeliveryConfirmed()) {
      this.openFarDeliveryConfirmation(() => {
        this.farDeliveryConfirmed.set(true);
        this.placeOrder();
      });
      return;
    }
    this.placingOrder.set(true);
    this.orderError.set('');

    if (this.selectedPayment === 'razorpay' && this.finalTotal > 0) {
      // New flow: initiate Razorpay order first, then create app order after payment
      this.api.initiateCheckoutPayment({
        delivery_address_id: this.selectedAddressId,
        coupon_code: this.appliedCoupon()?.code,
        wallet_amount: this.walletAmountToUse() || undefined,
        confirm_far_delivery: this.farDeliveryConfirmed(),
      }).subscribe({
        next: (rzData) => {
          this.pendingRzOrderId = rzData.razorpay_order_id;
          this.pendingRzAmount = rzData.amount;
          this.pendingRzCurrency = rzData.currency;
          this.openRazorpayModal(rzData);
        },
        error: (err) => this.handleApiOrderError(err),
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
    if (!this.selectedAddressId) {
      this.handleOrderError('Choose a delivery address before retrying payment.');
      return;
    }
    this.placingOrder.set(true);
    this.api.initiateCheckoutPayment({
      delivery_address_id: this.selectedAddressId,
      coupon_code: this.appliedCoupon()?.code,
      wallet_amount: this.walletAmountToUse() || undefined,
      confirm_far_delivery: this.farDeliveryConfirmed(),
    }).subscribe({
      next: (rzData) => {
        this.pendingRzOrderId = rzData.razorpay_order_id;
        this.pendingRzAmount = rzData.amount;
        this.openRazorpayModal(rzData);
      },
      error: (err) => this.handleApiOrderError(err),
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
    if (this.useLoyalty() && this.loyaltyMaxRedeemable() > 0) orderData.loyalty_points = this.loyaltyMaxRedeemable();
    if (this.scheduledFor()) orderData.scheduled_for = this.scheduledFor();
    if (this.farDeliveryConfirmed()) orderData.confirm_far_delivery = true;
    if (paymentProof) Object.assign(orderData, paymentProof);

    this.api.createOrder(orderData).subscribe({
      next: (orders) => {
        this.api.refreshCartCount();
        const orderId = Array.isArray(orders) ? orders[0]?.id : orders?.id;
        if (!orderId) { this.handleOrderError('Order created but ID missing.'); return; }
        if (!paymentProof && this.selectedPayment === 'razorpay') {
          this.alerts.info('Order placed. Complete payment from Order Details.');
        }
        setTimeout(() => this.router.navigate(['/order', orderId]), 300);
      },
      error: (err) => this.handleApiOrderError(err),
    });
  }

  private handleOrderError(msg: string) {
    this.orderError.set(msg);
    this.placingOrder.set(false);
  }

  private handleApiOrderError(err: any) {
    if (err?.status === 409 && err.error?.code === 'far_delivery_confirmation_required') {
      this.placingOrder.set(false);
      this.openFarDeliveryConfirmation(() => {
        this.farDeliveryConfirmed.set(true);
        this.placeOrder();
      }, err.error?.quotes || []);
      return;
    }
    if (err?.status === 400 && err?.error?.code === 'delivery_not_serviceable' && err?.error?.details) {
      const details = err.error.details;
      const detailedMessage =
        `${details.vendor_name} cannot deliver to your selected address. ` +
        `Store state: ${details.vendor_state || 'Unknown'} · Selected address state: ${details.address_state || 'Unknown'}.`;
      this.handleOrderError(detailedMessage);
      return;
    }
    this.handleOrderError(err?.error?.error || err?.error?.detail || err?.error?.non_field_errors?.[0] || 'Could not place order.');
  }

  requiresFarDeliveryConfirmation(): boolean {
    return !!this.deliveryFeePreview()?.requires_far_delivery_confirmation;
  }

  instantRadiusLabel(): string {
    const quotes = this.deliveryFeePreview()?.far_delivery_quotes || [];
    const radius = quotes.find((quote: any) => quote.instant_radius_km != null)?.instant_radius_km;
    if (!radius) return 'the instant delivery radius';
    const numericRadius = Number(radius);
    return `${numericRadius.toFixed(Number.isInteger(numericRadius) ? 0 : 1)} km`;
  }

  private openFarDeliveryConfirmation(onConfirm: () => void, quotes?: any[]) {
    const farQuotes = quotes?.length ? quotes : this.deliveryFeePreview()?.far_delivery_quotes || [];
    const message = farQuotes.map((quote: any) => (
      `${quote.vendor_name}: ${quote.distance_km} km away · ETA ${quote.far_order_eta_label || quote.estimated_delivery_label}`
    )).join('\n');
    this.alerts.openModal({
      title: 'This order is from farther away',
      message: `${message}\n\nDelivery will take longer because one or more shops are outside ${this.instantRadiusLabel()}. Do you still want to continue?`,
      tone: 'warning',
      confirmLabel: 'Continue order',
      cancelLabel: 'Review basket',
      onConfirm,
      onCancel: () => {
        this.placingOrder.set(false);
      },
    });
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
