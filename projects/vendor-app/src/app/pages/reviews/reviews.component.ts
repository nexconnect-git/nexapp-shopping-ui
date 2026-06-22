import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { VendorApi } from '@shared/public-api';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reviews.component.html',
  styleUrl: './reviews.component.scss',
})
export class ReviewsComponent implements OnInit {
  private api = inject(VendorApi);
  private router = inject(Router);

  loading = signal(true);
  reviews = signal<any[]>([]);
  averageRating = signal(0);
  totalReviews = signal(0);
  filter = signal<'all' | 'low' | 'recent'>('all');

  readonly stars = [1, 2, 3, 4, 5];

  ratingBreakdown = computed(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const r of this.reviews()) {
      const idx = Math.round(r.rating) - 1;
      if (idx >= 0 && idx < 5) counts[idx]++;
    }
    return counts.reverse(); // [5-star, 4-star, ..., 1-star]
  });

  lowReviews = computed(() =>
    this.reviews().filter((r) => Number(r.rating) <= 3),
  );

  filteredReviews = computed(() => {
    const list = [...this.reviews()];
    if (this.filter() === 'low')
      return list.filter((r) => Number(r.rating) <= 3);
    if (this.filter() === 'recent') {
      return list
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 10);
    }
    return list;
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
              const avg =
                list.reduce((s: number, r: any) => s + r.rating, 0) /
                list.length;
              this.averageRating.set(Math.round(avg * 10) / 10);
            }
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => this.loading.set(false),
    });
  }

  starsArray(n: number): number[] {
    return Array.from({ length: Math.min(5, Math.max(0, Math.round(n))) });
  }

  setFilter(filter: 'all' | 'low' | 'recent') {
    this.filter.set(filter);
  }

  goBack() {
    window.history.back();
  }
}
