import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiService, LocationService, Vendor } from '@shared/public-api';

@Component({
  selector: 'app-shops',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './shops.component.html',
  styleUrl: './shops.component.scss',
})
export class ShopsComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private locationService = inject(LocationService);

  allVendors = signal<Vendor[]>([]);
  loading = signal(true);

  searchQuery = '';
  cityFilter = '';
  sortBy = 'relevance';
  showSortSheet = false;
  pendingSort = 'relevance';
  searchMode = signal<'nearby' | 'manual_far'>('nearby');

  readonly sortOptions = [
    { value: 'relevance', label: 'Relevance (Default)' },
    { value: 'rating', label: 'Rating' },
    { value: 'distance', label: 'Distance (Nearest)' },
    { value: 'min_order_asc', label: 'Min Order: Low to High' },
  ];

  readonly visibleVendors = computed(() => {
    let list = [...this.allVendors()];
    if (this.cityFilter) {
      list = list.filter((vendor) => vendor.city === this.cityFilter);
    }
    if (this.sortBy === 'rating') list.sort((a, b) => b.average_rating - a.average_rating);
    else if (this.sortBy === 'distance') list.sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999));
    else if (this.sortBy === 'min_order_asc') list.sort((a, b) => (a.min_order_amount || 0) - (b.min_order_amount || 0));
    else {
      list.sort((a, b) => {
        const previousOrderDelta = Number(!!b.has_previously_ordered) - Number(!!a.has_previously_ordered);
        if (previousOrderDelta !== 0) return previousOrderDelta;
        return (a.distance_km || 999) - (b.distance_km || 999);
      });
    }
    return list;
  });

  readonly nearbyVendors = computed(() => this.visibleVendors().filter((vendor) => vendor.within_instant_radius !== false));
  readonly farVendors = computed(() => this.visibleVendors().filter((vendor) => vendor.within_instant_radius === false));
  readonly cities = computed(() => {
    const allCities = this.allVendors().map((vendor) => vendor.city).filter(Boolean);
    return [...new Set(allCities)] as string[];
  });

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      this.searchQuery = params['search'] || '';
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
    const search = this.searchQuery.trim();
    const request$ = search && location.state
      ? this.api.searchFarVendors({
          lat: location.lat,
          lng: location.lng,
          state: location.state,
          city: location.city,
          postal_code: location.postalCode,
          search,
        })
      : this.api.getNearbyVendors(location.lat, location.lng, 10, undefined, location.state, location.city, location.postalCode);

    this.searchMode.set(search ? 'manual_far' : 'nearby');
    request$.subscribe({
      next: (res) => {
        this.allVendors.set(res.results || res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch() {
    this.loadShops();
  }

  clearSearch() {
    this.searchQuery = '';
    this.cityFilter = '';
    this.loadShops();
  }

  openSortSheet() {
    this.pendingSort = this.sortBy;
    this.showSortSheet = true;
  }

  applySort() {
    this.sortBy = this.pendingSort;
    this.showSortSheet = false;
  }

  sortLabel(): string {
    return this.sortOptions.find((option) => option.value === this.sortBy)?.label || 'Sort By';
  }
}
