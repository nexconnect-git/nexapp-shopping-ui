import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, TitleCasePipe, SlicePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, AppCurrencyPipe, Cart, Address } from '@shared/public-api';

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
  imports: [CommonModule, FormsModule, AppCurrencyPipe, RouterLink, TitleCasePipe, SlicePipe],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss'
})
export class CheckoutComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  cart = signal<Cart | null>(null);
  addresses = signal<Address[]>([]);
  loading = signal(true);
  placingOrder = signal(false);
  orderError = signal('');

  selectedAddressId: string | null = null;
  selectedPayment = 'cod';
  notes = '';

  couponCode = '';
  appliedCoupon = signal<any>(null);
  couponError = signal('');
  couponLoading = signal(false);

  readonly paymentMethods: PaymentMethod[] = [
    { id: 'cod', label: 'Pay on Delivery', icon: 'payments', sub: 'Pay in cash or pay online' },
    { id: 'upi', label: 'UPI', icon: 'account_balance_wallet', sub: 'Add new UPI ID', disabled: true },
    { id: 'card', label: 'Credit / Debit Card', icon: 'credit_card', sub: 'Add new card via Stripe', disabled: true },
    { id: 'netbanking', label: 'Net Banking', icon: 'account_balance', sub: 'Select from a list of banks', disabled: true },
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
      }
    });
  }

  get selectedAddress(): Address | undefined {
    return this.addresses().find(a => a.id === this.selectedAddressId);
  }

  get discountedTotal(): number {
    const total = Number(this.cart()?.total_amount || 0);
    const discount = Number(this.appliedCoupon()?.discount || 0);
    return Math.max(total - discount, 0);
  }

  applyCoupon() {
    const code = this.couponCode.trim().toUpperCase();
    if (!code) return;
    this.couponLoading.set(true);
    this.couponError.set('');
    this.api.validateCoupon(code, Number(this.cart()?.total_amount || 0)).subscribe({
      next: (res) => {
        this.appliedCoupon.set(res);
        this.couponLoading.set(false);
      },
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

  placeOrder() {
    if (!this.selectedAddressId) return;
    this.placingOrder.set(true);
    this.orderError.set('');
    const orderData: any = { delivery_address_id: this.selectedAddressId, notes: this.notes };
    if (this.appliedCoupon()) orderData.coupon_code = this.appliedCoupon().code;
    this.api.createOrder(orderData).subscribe({
      next: (orders) => {
        this.api.refreshCartCount();
        const id = Array.isArray(orders) ? orders[0]?.id : orders?.id;
        setTimeout(() => this.router.navigate(['/order', id || '']), 300);
      },
      error: (err) => {
        this.orderError.set(err.error?.detail || err.error?.non_field_errors?.[0] || 'Could not place order.');
        this.placingOrder.set(false);
      }
    });
  }

  goBack() { window.history.back(); }
}


