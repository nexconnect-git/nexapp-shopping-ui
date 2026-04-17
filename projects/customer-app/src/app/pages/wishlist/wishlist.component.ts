import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ApiService, AppCurrencyPipe, ToastService } from '@shared/public-api';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [CommonModule, RouterLink, AppCurrencyPipe],
  templateUrl: './wishlist.component.html',
  styleUrl: './wishlist.component.scss'
})
export class WishlistComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);

  products = signal<any[]>([]);
  loading = signal(true);
  removingId = signal('');
  addingId = signal('');

  ngOnInit() {
    this.api.getWishlist().subscribe({
      next: (res) => { this.products.set(res.results || res); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  removeFromWishlist(product: any) {
    this.removingId.set(product.id);
    this.api.toggleWishlist(product.id).subscribe({
      next: () => {
        this.products.update(list => list.filter(p => p.id !== product.id));
        this.removingId.set('');
      },
      error: () => this.removingId.set(''),
    });
  }

  addToCart(product: any) {
    this.addingId.set(product.id);
    this.api.addToCart(product.id, 1).subscribe({
      next: () => {
        this.api.refreshCartCount();
        this.toast.show(`${product.name} added to cart`, 'success');
        this.addingId.set('');
      },
      error: () => {
        this.toast.show('Could not add to cart.', 'error');
        this.addingId.set('');
      },
    });
  }

  goBack() { window.history.back(); }
}
