import { AfterViewInit, Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { ApiService, LocationService, Vendor } from '@shared/public-api';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchComponent implements OnInit, AfterViewInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private locationService = inject(LocationService);

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  queryValue = '';
  storeResults = signal<Vendor[]>([]);
  searching = signal(false);
  loadingPopular = signal(true);
  pastSearches = signal<string[]>([]);
  popularVendors = signal<Vendor[]>([]);
  quickCategories = signal<any[]>([]);
  private allQuickCategories: any[] = [];
  quickIdeas = ['Milk & bread', 'Fresh vegetables', 'Chicken biryani', 'Pain relief', 'Bakery'];

  private timer: any;

  ngOnInit() {
    this.loadPastSearches();
    this.loadPopular();
    this.loadQuickCategories();
  }

  ngAfterViewInit() {
    setTimeout(() => this.searchInput?.nativeElement?.focus(), 100);
  }

  loadPastSearches() {
    try {
      const stored = localStorage.getItem('nx_searches');
      if (stored) this.pastSearches.set(JSON.parse(stored));
    } catch {
      // Ignore local cache parsing errors.
    }
  }

  loadPopular() {
    const location = this.locationService.location();
    const request$ = location
      ? this.api.getNearbyVendors(location.lat, location.lng, 10, undefined, location.state, location.city, location.postalCode)
      : this.api.getVendors({});
    request$.subscribe({
      next: (res) => {
        this.popularVendors.set((res.results || res).slice(0, 12));
        this.refreshQuickCategories();
        this.loadingPopular.set(false);
      },
      error: () => this.loadingPopular.set(false),
    });
  }

  loadQuickCategories() {
    this.api.getCategories().subscribe({
      next: (res) => {
        this.allQuickCategories = (res.results || res).filter((c: any) => c.show_in_customer_ui !== false);
        this.refreshQuickCategories();
      },
      error: () => this.quickCategories.set([]),
    });
  }

  private refreshQuickCategories() {
    if (!this.allQuickCategories.length) return;
    const availableSlugs = new Set<string>();
    for (const vendor of this.popularVendors()) {
      for (const product of vendor.products || []) {
        if (product.category?.slug) availableSlugs.add(product.category.slug);
      }
    }
    const categories = this.allQuickCategories.filter((category) => {
      if (availableSlugs.has(category.slug)) return true;
      return (category.children || []).some((child: any) => availableSlugs.has(child.slug));
    });
    this.quickCategories.set(categories.slice(0, 6));
  }

  onSearch() {
    clearTimeout(this.timer);
    if (!this.queryValue.trim()) {
      this.storeResults.set([]);
      return;
    }
    this.timer = setTimeout(() => this.doSearch(), 300);
  }

  doSearch() {
    const query = this.queryValue.trim();
    if (!query) {
      this.storeResults.set([]);
      return;
    }
    this.searching.set(true);
    const location = this.locationService.location();
    const request$ = location?.state
      ? this.api.globalShopSearch({
          lat: location.lat,
          lng: location.lng,
          state: location.state,
          city: location.city,
          postal_code: location.postalCode,
          product_query: query,
        })
      : this.api.getVendors({ search: query });
    request$.subscribe({
      next: (res) => {
        this.storeResults.set((res.results || res).slice(0, 12));
        this.searching.set(false);
      },
      error: () => this.searching.set(false),
    });
  }

  goBack() {
    window.history.back();
  }

  get hasResults() {
    return this.storeResults().length > 0;
  }

  selectVendor(vendorId: string) {
    this.saveSearch(this.queryValue || '');
    this.router.navigate(['/shop', vendorId]);
  }

  selectSearch(query: string) {
    this.queryValue = query;
    this.saveSearch(query);
    this.doSearch();
  }

  selectCategory(category: any) {
    this.router.navigate(['/shops'], { queryParams: { category: category.slug } });
  }

  showAll() {
    this.saveSearch(this.queryValue);
    this.router.navigate(['/shops'], { queryParams: { search: this.queryValue } });
  }

  saveSearch(query: string) {
    if (!query.trim()) return;
    const list = [query, ...this.pastSearches().filter((entry) => entry !== query)].slice(0, 8);
    this.pastSearches.set(list);
    try {
      localStorage.setItem('nx_searches', JSON.stringify(list));
    } catch {
      // Ignore local storage write failures.
    }
  }

  removeSearch(query: string, event: Event) {
    event.stopPropagation();
    const list = this.pastSearches().filter((entry) => entry !== query);
    this.pastSearches.set(list);
    try {
      localStorage.setItem('nx_searches', JSON.stringify(list));
    } catch {
      // Ignore local storage write failures.
    }
  }

  highlight(text: string): SafeHtml {
    const query = this.queryValue.trim();
    if (!query) return text;
    const escaped = text.replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&#39;', '"': '&quot;' }[char] || char));
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const html = escaped.replace(new RegExp(`(${safeQuery})`, 'gi'), '<strong>$1</strong>');
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
