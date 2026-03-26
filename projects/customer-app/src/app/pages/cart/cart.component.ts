import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, Cart, Address } from '@shared/public-api';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  cart = signal<Cart | null>(null);
  addresses = signal<Address[]>([]);
  loading = signal(true);
  updatingId = signal<string | null>(null);
  placingOrder = signal(false);
  orderSuccess = signal(false);
  orderError = signal('');
  selectedAddressId: string | null = null;
  notes = '';

  ngOnInit() {
    this.loadCart();
    this.api.getAddresses().subscribe({ next: (r) => {
      const addrs: Address[] = r.results || r;
      this.addresses.set(addrs);
      const def = addrs.find(a => a.is_default);
      if (def) this.selectedAddressId = def.id;
      else if (addrs.length) this.selectedAddressId = addrs[0].id;
    }});
  }

  loadCart() {
    this.api.getCart().subscribe({
      next: (c) => { this.cart.set(c); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  updateQty(item: any, qty: number) {
    if (qty < 1) { this.removeItem(item); return; }
    this.updatingId.set(item.id);
    this.api.updateCartItem(item.id, qty).subscribe({
      next: () => { this.updatingId.set(null); this.loadCart(); },
      error: () => this.updatingId.set(null)
    });
  }

  removeItem(item: any) {
    this.api.removeCartItem(item.id).subscribe({ next: () => this.loadCart() });
  }

  clearCart() {
    this.api.clearCart().subscribe({ next: () => this.loadCart() });
  }

  placeOrder() {
    if (!this.selectedAddressId) return;
    this.placingOrder.set(true);
    this.orderError.set('');
    this.api.createOrder({ delivery_address_id: this.selectedAddressId, notes: this.notes }).subscribe({
      next: (orders) => {
        this.orderSuccess.set(true);
        this.placingOrder.set(false);
        this.api.refreshCartCount();
        setTimeout(() => this.router.navigate(['/orders']), 1500);
      },
      error: (err) => {
        this.orderError.set(err.error?.detail || err.error?.non_field_errors?.[0] || 'Could not place order.');
        this.placingOrder.set(false);
      }
    });
  }
}
