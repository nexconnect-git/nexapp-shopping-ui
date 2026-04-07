import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, Vendor } from '@shared/public-api';

@Component({
  selector: 'app-shops',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule,],
  templateUrl: './shops.component.html',
  styleUrl: './shops.component.scss'
})
export class ShopsComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  allVendors = signal<Vendor[]>([]);
  vendors = computed(() => {
    let list = [...this.allVendors()];
    if (this.sortBy === 'rating') list.sort((a, b) => b.average_rating - a.average_rating);
    else if (this.sortBy === 'distance') list.sort((a, b) => (a.distance_km || 99) - (b.distance_km || 99));
    else if (this.sortBy === 'min_order_asc') list.sort((a, b) => (a.min_order_amount || 0) - (b.min_order_amount || 0));
    return list;
  });

  cities = signal<string[]>([]);
  loading = signal(true);
  page = signal(1);
  totalPages = signal(1);
  searchQuery = '';
  cityFilter = '';
  openOnly = false;

  sortBy = 'relevance';
  showSortSheet = false;
  pendingSort = 'relevance';

  readonly sortOptions = [
    { value: 'relevance', label: 'Relevance (Default)' },
    { value: 'rating', label: 'Rating' },
    { value: 'distance', label: 'Distance (Nearest)' },
    { value: 'min_order_asc', label: 'Min Order: Low to High' },
  ];

  private searchTimer: any;

  pageRange = computed(() => {
    const total = this.totalPages();
    const current = this.page();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(current - 3, total - 6));
    return Array.from({ length: Math.min(7, total) }, (_, i) => start + i);
  });

  ngOnInit() {
    this.route.queryParams.subscribe(p => {
      if (p['search']) this.searchQuery = p['search'];
      this.load();
    });
  }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page() };
    if (this.searchQuery) params.search = this.searchQuery;
    if (this.cityFilter) params.city = this.cityFilter;
    if (this.openOnly) params.is_open = true;

    this.api.getVendors(params).subscribe({
      next: (res) => {
        const results = res.results || res;
        this.allVendors.set(results);
        if (res.count) this.totalPages.set(Math.ceil(res.count / 20));
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

  openSortSheet() { this.pendingSort = this.sortBy; this.showSortSheet = true; }

  applySort() {
    this.sortBy = this.pendingSort;
    this.showSortSheet = false;
  }

  sortLabel(): string {
    return this.sortOptions.find(o => o.value === this.sortBy)?.label || 'Sort By';
  }
}
