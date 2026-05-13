import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiService, AppCurrencyPipe, LocationService, Vendor } from '@shared/public-api';

@Component({
  selector: 'app-shops',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, AppCurrencyPipe],
  templateUrl: './shops.component.html',
  styleUrl: './shops.component.scss',
})
export class ShopsComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private locationService = inject(LocationService);

  allVendors = signal<Vendor[]>([]);
  loading = signal(true);
  filtering = signal(false);

  searchQuery = '';
  categoryFilter = signal('');
  cityFilter = signal('');
  sortBy = signal('relevance');
  showSortSheet = false;
  pendingSort = 'relevance';
  searchMode = signal<'nearby' | 'manual_far'>('nearby');
  private searchTimer?: ReturnType<typeof setTimeout>;

  readonly sortOptions = [
    { value: 'relevance', label: 'Relevance (Default)' },
    { value: 'rating', label: 'Rating' },
    { value: 'distance', label: 'Distance (Nearest)' },
    { value: 'min_order_asc', label: 'Min Order: Low to High' },
  ];

  readonly visibleVendors = computed(() => {
    let list = [...this.allVendors()];
    const city = this.cityFilter();
    const sort = this.sortBy();

    if (city) {
      list = list.filter((vendor) => vendor.city === city);
    }
    if (sort === 'rating') list.sort((a, b) => b.average_rating - a.average_rating);
    else if (sort === 'distance') list.sort((a, b) => (Number(a.distance_km) || 999) - (Number(b.distance_km) || 999));
    else if (sort === 'min_order_asc') list.sort((a, b) => Number(a.min_order_amount || 0) - Number(b.min_order_amount || 0));
    else {
      list.sort((a, b) => {
        const previousOrderDelta = Number(!!b.has_previously_ordered) - Number(!!a.has_previously_ordered);
        if (previousOrderDelta !== 0) return previousOrderDelta;
        return (Number(a.distance_km) || 999) - (Number(b.distance_km) || 999);
      });
    }
    return list;
  });

  readonly nearbyVendors = computed(() => this.visibleVendors().filter((vendor) => vendor.within_instant_radius !== false));
  readonly farVendors = computed(() => this.visibleVendors().filter((vendor) => vendor.within_instant_radius === false));
  readonly cities = computed(() => {
    const allCities = this.allVendors().map((vendor) => vendor.city).filter(Boolean);
    return [...new Set(allCities)].sort((a, b) => a.localeCompare(b)) as string[];
  });

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      this.searchQuery = params['search'] || '';
      this.categoryFilter.set(params['category'] || '');
      this.initLocationAndLoad();
    });
  }

  initLocationAndLoad() {
    const location = this.locationService.location();
    if (location) {
      this.loadShops();
      return;
    }
    this.loading.set(true);
    this.locationService.initializeLocation().then(() => this.loadShops());
  }

  loadShops() {
    const location = this.locationService.location();
    if (!location) {
      this.allVendors.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.filtering.set(true);
    const search = this.searchQuery.trim();
    const category = this.categoryFilter();
    const request$ = search && location.state
      ? this.api.searchFarVendors({
          lat: location.lat,
          lng: location.lng,
          state: location.state,
          city: location.city,
          postal_code: location.postalCode,
          search,
          category,
        })
      : this.api.getNearbyVendors(location.lat, location.lng, 10, category, location.state, location.city, location.postalCode);

    this.searchMode.set(search ? 'manual_far' : 'nearby');
    request$.subscribe({
      next: (res) => {
        this.allVendors.set(res.results || res);
        if (this.cityFilter() && !this.cities().includes(this.cityFilter())) {
          this.cityFilter.set('');
        }
        this.loading.set(false);
        this.filtering.set(false);
      },
      error: () => { this.loading.set(false); this.filtering.set(false); },
    });
  }

  onSearch() {
    this.filtering.set(true);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadShops(), 260);
  }

  setCityFilter(city: string) {
    this.filtering.set(true);
    this.cityFilter.set(city);
    setTimeout(() => this.filtering.set(false), 180);
  }

  clearSearch() {
    this.searchQuery = '';
    this.categoryFilter.set('');
    this.cityFilter.set('');
    this.loadShops();
  }

  openSortSheet() {
    this.pendingSort = this.sortBy();
    this.showSortSheet = true;
  }

  applySort() {
    this.filtering.set(true);
    this.sortBy.set(this.pendingSort);
    this.showSortSheet = false;
    setTimeout(() => this.filtering.set(false), 180);
  }

  sortLabel(): string {
    return this.sortOptions.find((option) => option.value === this.sortBy())?.label || 'Sort';
  }

  selectedCityLabel(): string {
    return this.cityFilter() || 'All delivery areas';
  }

  hasMinimumOrder(vendor: Vendor): boolean {
    return Number(vendor.min_order_amount || 0) > 0;
  }
}
