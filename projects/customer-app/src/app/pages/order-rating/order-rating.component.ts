import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '@shared/public-api';

@Component({
  selector: 'app-order-rating',
  standalone: true,
  imports: [CommonModule],
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
  submitted = signal(false);

  deliveryRating = 0;
  hoverRating = 0;
  orderId = '';

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
        this.submitted.set(true);
      },
      error: () => {
        this.submitting.set(false);
      }
    });
  }

  goToOrders() { this.router.navigate(['/profile/orders']); }
  goBack() { window.history.back(); }
}
