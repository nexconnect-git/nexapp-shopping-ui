import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '@shared/public-api';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reviews.component.html',
  styleUrl: './reviews.component.scss'
})
export class ReviewsComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  loading = signal(true);
  reviews = signal<any[]>([]);
  averageRating = signal(0);
  totalReviews = signal(0);

  readonly stars = [1, 2, 3, 4, 5];

  ratingBreakdown = computed(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const r of this.reviews()) {
      const idx = Math.round(r.rating) - 1;
      if (idx >= 0 && idx < 5) counts[idx]++;
    }
    return counts.reverse(); // [5-star, 4-star, ..., 1-star]
  });

  ngOnInit() {
    this.api.getVendorProfile().subscribe({
      next: (profile) => {
        const vendorId = profile.id;
        this.api.getVendorReviews(vendorId).subscribe({
          next: (res) => {
            const list = res.results || res || [];
            this.reviews.set(list);
            this.totalReviews.set(list.length);
            if (list.length > 0) {
              const avg = list.reduce((s: number, r: any) => s + r.rating, 0) / list.length;
              this.averageRating.set(Math.round(avg * 10) / 10);
            }
            this.loading.set(false);
          },
          error: () => this.loading.set(false)
        });
      },
      error: () => this.loading.set(false)
    });
  }

  starsArray(n: number): number[] {
    return Array.from({ length: Math.min(5, Math.max(0, Math.round(n))) });
  }

  goBack() { window.history.back(); }
}
