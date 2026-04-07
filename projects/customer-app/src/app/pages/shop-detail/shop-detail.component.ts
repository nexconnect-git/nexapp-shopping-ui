import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, AppCurrencyPipe, Vendor, Product } from '@shared/public-api';

@Component({
  selector: 'app-shop-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, AppCurrencyPipe],
  templateUrl: './shop-detail.component.html',
  styleUrl: './shop-detail.component.scss'
})
export class ShopDetailComponent implements OnInit {
  api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  vendor = signal<Vendor | null>(null);
  products = signal<Product[]>([]);
  loading = signal(true);
  showInfo = signal(false);
  showSearch = signal(false);
  addingId = signal<string | null>(null);

  searchQuery = '';
  filterRating = false;

  cartQty = signal<Record<string, number>>({});
  cartItemId: Record<string, string> = {};
  cartVendorId = signal<string | null>(null);
  cartVendorName = signal('');
  pendingAdd = signal<Product | null>(null);
  showReplaceDialog = signal(false);
  clearing = signal(false);

  filteredProducts = computed(() => {
    let list = this.products();
    const q = this.searchQuery.toLowerCase().trim();
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)));
    if (this.filterRating) list = list.filter(p => p.average_rating >= 4.0);
    return list;
  });

  suggestions = computed(() =>
    [...this.products()]
      .sort((a, b) => b.average_rating - a.average_rating)
      .slice(0, 6)
  );

  totalCartItems = computed(() =>
    Object.values(this.cartQty()).reduce((s, q) => s + q, 0)
  );

  totalCartAmount = computed(() => {
    const qty = this.cartQty();
    return this.products().reduce((sum, p) => sum + (qty[p.id] || 0) * Number(p.price), 0);
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getVendor(id).subscribe({
      next: (v) => {
        this.vendor.set(v);
        this.products.set(v.products || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
    this.syncCart();
  }

  syncCart() {
    this.api.getCart().subscribe({
      next: (cart) => {
        const qty: Record<string, number> = {};
        const items = cart.items || [];
        for (const item of items) {
          qty[item.product.id] = item.quantity;
          this.cartItemId[item.product.id] = item.id;
        }
        this.cartQty.set(qty);
        if (items.length > 0) {
          this.cartVendorId.set(items[0].product.vendor);
          this.cartVendorName.set(items[0].product.vendor_name || 'another store');
        } else {
          this.cartVendorId.set(null);
          this.cartVendorName.set('');
        }
      }
    });
  }

  getQty(productId: string): number {
    return this.cartQty()[productId] || 0;
  }

  add(product: Product) {
    if (this.addingId()) return;
    const cartVendor = this.cartVendorId();
    const myVendorId = this.vendor()?.id;
    if (cartVendor && cartVendor !== myVendorId) {
      this.pendingAdd.set(product);
      this.showReplaceDialog.set(true);
      return;
    }
    this.doAdd(product);
  }

  doAdd(product: Product) {
    this.addingId.set(product.id);
    this.api.addToCart(product.id, 1).subscribe({
      next: () => {
        this.addingId.set(null);
        this.syncCart();
        this.api.refreshCartCount();
      },
      error: () => this.addingId.set(null)
    });
  }

  confirmReplace() {
    const product = this.pendingAdd();
    if (!product) return;
    this.showReplaceDialog.set(false);
    this.clearing.set(true);
    this.api.clearCart().subscribe({
      next: () => {
        this.cartQty.set({});
        this.cartItemId = {};
        this.cartVendorId.set(null);
        this.cartVendorName.set('');
        this.clearing.set(false);
        this.api.refreshCartCount();
        this.doAdd(product);
        this.pendingAdd.set(null);
      },
      error: () => this.clearing.set(false)
    });
  }

  cancelReplace() {
    this.pendingAdd.set(null);
    this.showReplaceDialog.set(false);
  }

  increment(product: Product) {
    const itemId = this.cartItemId[product.id];
    if (!itemId) { this.add(product); return; }
    const next = this.getQty(product.id) + 1;
    this.api.updateCartItem(itemId, next).subscribe({
      next: () => { this.syncCart(); this.api.refreshCartCount(); }
    });
  }

  decrement(product: Product) {
    const itemId = this.cartItemId[product.id];
    if (!itemId) return;
    const current = this.getQty(product.id);
    const obs = current <= 1
      ? this.api.removeCartItem(itemId)
      : this.api.updateCartItem(itemId, current - 1);
    obs.subscribe({ next: () => { this.syncCart(); this.api.refreshCartCount(); } });
  }

  toggleInfo() { this.showInfo.update(v => !v); }
  toggleSearch() { this.showSearch.update(v => !v); if (!this.showSearch()) this.searchQuery = ''; }
  goToCart() { this.router.navigate(['/cart']); }
  goBack() { window.history.back(); }
}
