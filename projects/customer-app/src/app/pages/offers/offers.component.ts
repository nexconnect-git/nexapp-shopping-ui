import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '@shared/public-api';

@Component({
  selector: 'app-offers',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './offers.component.html',
  styleUrl: './offers.component.scss'
})
export class OffersComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  coupons = signal<any[]>([]);
  loading = signal(true);
  copiedCode = signal('');

  readonly iconMap: Record<string, string> = {
    percentage: 'percent',
    fixed: 'local_offer',
    free_delivery: 'delivery_dining'
  };

  readonly colorMap: Record<string, { color: string; bg: string }> = {
    percentage: { color: '#7c3aed', bg: '#f3e8ff' },
    fixed: { color: '#059669', bg: '#d1fae5' },
    free_delivery: { color: '#0284c7', bg: '#e0f2fe' }
  };

  ngOnInit() {
    this.api.getCoupons().subscribe({
      next: (res) => {
        this.coupons.set(res.results || res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  discountLabel(coupon: any): string {
    if (coupon.discount_type === 'percentage') return `${coupon.discount_value}% OFF`;
    if (coupon.discount_type === 'free_delivery') return 'FREE DELIVERY';
    return `FLAT ${coupon.discount_value} OFF`;
  }

  iconFor(coupon: any): string {
    return this.iconMap[coupon.discount_type] ?? 'local_offer';
  }

  colorFor(coupon: any) {
    return this.colorMap[coupon.discount_type] ?? { color: '#555', bg: '#f5f5f5' };
  }

  copyCode(code: string) {
    navigator.clipboard.writeText(code).catch(() => {});
    this.copiedCode.set(code);
    setTimeout(() => this.copiedCode.set(''), 2000);
  }

  goBack() {
    window.history.back();
  }

  browseStores() {
    this.router.navigate(['/shops']);
  }

  browseProducts() {
    this.router.navigate(['/search']);
  }
}
