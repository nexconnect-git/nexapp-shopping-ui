import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ApiService, AuthService, Vendor, Product } from '@shared/public-api';

@Component({
  selector: 'app-shop-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './shop-detail.component.html',
  styleUrl: './shop-detail.component.scss'
})
export class ShopDetailComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  vendor = signal<Vendor | null>(null);
  products = signal<Product[]>([]);
  loading = signal(true);

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
  }

  starsFor(r: number) { const f = Math.round(r); return '★'.repeat(f) + '☆'.repeat(5 - f); }
}
