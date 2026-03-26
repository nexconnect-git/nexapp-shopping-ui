import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, Vendor } from '@shared/public-api';

@Component({
  selector: 'app-shops',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './shops.component.html',
  styleUrl: './shops.component.scss'
})
export class ShopsComponent implements OnInit {
  private api = inject(ApiService);

  vendors = signal<Vendor[]>([]);
  cities = signal<string[]>([]);
  loading = signal(true);
  page = signal(1);
  totalPages = signal(1);
  searchQuery = '';
  cityFilter = '';
  openOnly = false;

  private searchTimer: any;

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page() };
    if (this.searchQuery) params.search = this.searchQuery;
    if (this.cityFilter) params.city = this.cityFilter;
    if (this.openOnly) params.is_open = true;

    this.api.getVendors(params).subscribe({
      next: (res) => {
        const results = res.results || res;
        this.vendors.set(results);
        if (res.count) this.totalPages.set(Math.ceil(res.count / 20));
        // extract unique cities
        const allCities = results.map((v: Vendor) => v.city).filter(Boolean);
        const unique = [...new Set<string>(allCities)] as string[];
        if (unique.length) this.cities.set(unique);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.load(); }, 400);
  }

  setPage(p: number) { this.page.set(p); this.load(); }

  starsFor(r: number) { const f = Math.round(r); return '★'.repeat(f) + '☆'.repeat(5 - f); }
}
