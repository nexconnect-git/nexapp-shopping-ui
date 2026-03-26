import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, AuthService } from '@shared/public-api';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
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
        this.cartError.set(err.error?.detail || 'Could not add to cart.');
        this.addingToCart.set(false);
      }
    });
  }

  decQty() { if (this.qty > 1) this.qty--; }
  incQty() { const p = this.product(); if (p && this.qty < p.stock) this.qty++; }
  starsFor(r: number) { const f = Math.round(r); return '★'.repeat(f) + '☆'.repeat(5 - f); }
}
