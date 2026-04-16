import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, AppCurrencyPipe, AuthService } from '@shared/public-api';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, AppCurrencyPipe],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss'
})
export class ProductDetailComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  product = signal<any | null>(null);
  reviews = signal<any[]>([]);
  selectedImage = signal<string | null>(null);
  loading = signal(true);
  addingToCart = signal(false);
  cartSuccess = signal(false);
  cartError = signal('');
  showClearCartDialog = signal(false);
  pendingAction = signal<'cart' | 'buyNow' | null>(null);
  qty = 1;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.api.getProduct(id).subscribe({
      next: (res) => {
        this.product.set(res);
        this.selectedImage.set(
          res.primary_image || (res.images?.length ? res.images[0].image : null)
        );
        this.loading.set(false);
        this.api.getProductReviews(id).subscribe({
          next: (rev) => this.reviews.set(rev.results || rev),
          error: () => {}
        });
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  addToCart() {
    if (!this.auth.isLoggedIn()) { this.router.navigate(['/login']); return; }
    const p = this.product();
    if (!p) return;

    this.addingToCart.set(true);
    this.cartError.set('');

    this.api.addToCart(p.id, this.qty).subscribe({
      next: () => {
        this.cartSuccess.set(true);
        this.addingToCart.set(false);
        this.api.refreshCartCount();
        setTimeout(() => this.cartSuccess.set(false), 3000);
      },
      error: (err) => {
        this.addingToCart.set(false);
        if (err.status === 409) {
          this.pendingAction.set('cart');
          this.showClearCartDialog.set(true);
        } else {
          this.cartError.set(err.error?.error || err.error?.detail || 'Could not add to cart.');
        }
      }
    });
  }

  buyNow() {
    if (!this.auth.isLoggedIn()) { this.router.navigate(['/login']); return; }
    const p = this.product();
    if (!p) return;

    this.addingToCart.set(true);
    this.cartError.set('');
    this.api.addToCart(p.id, this.qty).subscribe({
      next: () => {
        this.addingToCart.set(false);
        this.api.refreshCartCount();
        this.router.navigate(['/cart']);
      },
      error: (err) => {
        this.addingToCart.set(false);
        if (err.status === 409) {
          this.pendingAction.set('buyNow');
          this.showClearCartDialog.set(true);
        } else {
          this.cartError.set(err.error?.error || err.error?.detail || 'Could not add to cart.');
        }
      }
    });
  }

  confirmClearAndAdd() {
    const p = this.product();
    if (!p) return;
    this.showClearCartDialog.set(false);
    const action = this.pendingAction();
    this.pendingAction.set(null);

    this.api.clearCart().subscribe({
      next: () => {
        this.api.addToCart(p.id, this.qty).subscribe({
          next: () => {
            this.api.refreshCartCount();
            if (action === 'buyNow') {
              this.router.navigate(['/cart']);
            } else {
              this.cartSuccess.set(true);
              setTimeout(() => this.cartSuccess.set(false), 3000);
            }
          },
          error: (err) => {
            this.cartError.set(err.error?.error || 'Could not add to cart.');
          }
        });
      },
      error: () => {
        this.cartError.set('Could not clear cart. Please try again.');
      }
    });
  }

  dismissClearCartDialog() {
    this.showClearCartDialog.set(false);
    this.pendingAction.set(null);
  }

  decQty() { if (this.qty > 1) this.qty--; }
  incQty() { const p = this.product(); if (p && (p.stock === 0 || this.qty < p.stock)) this.qty++; }
  starsFor(r: number) { const f = Math.round(r); return '★'.repeat(f) + '☆'.repeat(5 - f); }
}
