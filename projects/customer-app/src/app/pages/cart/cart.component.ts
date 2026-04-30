import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, AppCurrencyPipe, Cart } from '@shared/public-api';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, AppCurrencyPipe],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private location = inject(Location);

  cart = signal<Cart | null>(null);
  loading = signal(true);
  updatingId = signal<string | null>(null);
  suggestions = signal<any[]>([]);
  addingSuggId = signal<string | null>(null);

  // Real savings from compare prices on discounted items.
  savings = computed(() => {
    const items = this.cart()?.items || [];
    return items.reduce((sum, item) => {
      const compare = Number(item.product.compare_price || 0);
      const price = Number(item.product.price || 0);
      if (!compare || compare <= price) return sum;
      return sum + ((compare - price) * item.quantity);
    }, 0);
  });

  ngOnInit() {
    this.loadCart();
  }

  loadCart() {
    this.api.getCart().subscribe({
      next: (c) => {
        this.cart.set(c);
        this.loading.set(false);
        if (c.items?.length > 0) {
          const vendorId = c.items[0]?.product?.vendor as any;
          if (vendorId) this.loadSuggestions(typeof vendorId === 'string' ? vendorId : vendorId?.id);
        }
      },
      error: () => this.loading.set(false)
    });
  }

  loadSuggestions(vendorId?: string) {
    if (!vendorId) return;
    this.api.getVendor(vendorId).subscribe({
      next: (v) => {
        const cartProductIds = new Set((this.cart()?.items || []).map((i: any) => i.product.id));
        const prods = (v.products || []).filter((p: any) => !cartProductIds.has(p.id)).slice(0, 8);
        this.suggestions.set(prods);
      }
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

  addSuggestion(product: any) {
    this.addingSuggId.set(product.id);
    this.api.addToCart(product.id, 1).subscribe({
      next: () => {
        this.addingSuggId.set(null);
        this.loadCart();
        this.api.refreshCartCount();
      },
      error: () => this.addingSuggId.set(null)
    });
  }

  goBack() { this.location.back(); }
  proceedToCheckout() {
    this.router.navigate(['/checkout']);
  }
}
