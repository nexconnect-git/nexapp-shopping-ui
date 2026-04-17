import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '@shared/public-api';

@Component({
  selector: 'app-order-rating',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-rating.component.html',
  styleUrl: './order-rating.component.scss'
})
export class OrderRatingComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);

  order = signal<any>(null);
  loading = signal(true);
  submitting = signal(false);
  step = signal<1 | 2 | 'done'>(1);

  // Step 1 — delivery rating
  deliveryRating = 0;
  hoverRating = 0;
  orderId = '';

  // Step 2 — vendor/shop review
  shopRating = 0;
  shopHover = 0;
  reviewComment = '';
  submittingReview = signal(false);

  readonly stars = [1, 2, 3, 4, 5];

  readonly ratingLabels: Record<number, string> = {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Great',
    5: 'Excellent!'
  };

  ngOnInit() {
    this.orderId = this.route.snapshot.paramMap.get('id') || '';
    this.api.getOrder(this.orderId).subscribe({
      next: (o) => { this.order.set(o); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  // Step 1
  setRating(r: number) { this.deliveryRating = r; }
  setHover(r: number) { this.hoverRating = r; }
  clearHover() { this.hoverRating = 0; }
  activeRating(): number { return this.hoverRating || this.deliveryRating; }

  submitRating() {
    if (!this.deliveryRating) return;
    this.submitting.set(true);
    this.api.submitOrderRating(this.orderId, this.deliveryRating).subscribe({
      next: () => {
        this.submitting.set(false);
        this.step.set(2);
      },
      error: () => this.submitting.set(false)
    });
  }

  // Step 2
  setShopRating(r: number) { this.shopRating = r; }
  setShopHover(r: number) { this.shopHover = r; }
  clearShopHover() { this.shopHover = 0; }
  activeShopRating(): number { return this.shopHover || this.shopRating; }

  submitReview() {
    const vendorId = this.order()?.vendor;
    if (!vendorId || !this.shopRating) return;
    this.submittingReview.set(true);
    this.api.createVendorReview(vendorId, { rating: this.shopRating, comment: this.reviewComment.trim() }).subscribe({
      next: () => {
        this.submittingReview.set(false);
        this.step.set('done');
      },
      error: () => {
        this.submittingReview.set(false);
        this.step.set('done');
      }
    });
  }

  skipReview() { this.step.set('done'); }

  goToOrders() { this.router.navigate(['/orders']); }
  goBack() { window.history.back(); }
}
