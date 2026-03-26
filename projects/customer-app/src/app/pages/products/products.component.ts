import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, Product, Category } from '@shared/public-api';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss'
})
export class ProductsComponent implements OnInit {
  private api = inject(ApiService);

  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  loading = signal(true);
  page = signal(1);
  totalPages = signal(1);
  totalCount = signal(0);

  searchQuery = '';
  categoryFilter: string | null = null;
  minPrice: number | null = null;
  maxPrice: number | null = null;
  inStockOnly = false;
  ordering = '';

  private searchTimer: any;

  ngOnInit() {
    this.api.getCategories().subscribe({ next: (res) => this.categories.set(res.results || res) });
    this.load();
  }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page() };
    if (this.searchQuery) params.search = this.searchQuery;
    if (this.categoryFilter) params.category = this.categoryFilter;
    if (this.minPrice != null) params.min_price = this.minPrice;
    if (this.maxPrice != null) params.max_price = this.maxPrice;
    if (this.inStockOnly) params.is_available = true;
    if (this.ordering) params.ordering = this.ordering;

    this.api.getProducts(params).subscribe({
      next: (res) => {
        this.products.set(res.results || res);
        this.totalCount.set(res.count || 0);
        this.totalPages.set(Math.ceil((res.count || 0) / 20) || 1);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  applyFilters() { this.page.set(1); this.load(); }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.load(); }, 400);
  }

  setPage(p: number) { this.page.set(p); this.load(); }

  starsFor(r: number) { const f = Math.round(r); return '★'.repeat(f) + '☆'.repeat(5 - f); }
}
