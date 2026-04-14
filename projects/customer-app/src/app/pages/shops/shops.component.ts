import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, Vendor, LocationService } from '@shared/public-api';

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
  private locationService = inject(LocationService);

  allVendors = signal<Vendor[]>([]);
  vendors = computed(() => {
    let list = [...this.allVendors()];
    
    // Apply local filters since getNearbyVendors returns raw unpaginated list
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(v => 
        (v.store_name && v.store_name.toLowerCase().includes(q)) || 
        (v.description && v.description.toLowerCase().includes(q))
      );
    }
    if (this.cityFilter) {
      list = list.filter(v => v.city === this.cityFilter);
    }
    if (this.openOnly) {
      list = list.filter(v => v.is_open);
    }

    if (this.sortBy === 'rating') list.sort((a, b) => b.average_rating - a.average_rating);
    else if (this.sortBy === 'distance') list.sort((a, b) => (a.distance_km || 99) - (b.distance_km || 99));
    else if (this.sortBy === 'min_order_asc') list.sort((a, b) => (a.min_order_amount || 0) - (b.min_order_amount || 0));
    return list;
  });

  cities = signal<string[]>([]);
  loading = signal(true);
  
  searchQuery = '';
  cityFilter = '';
  openOnly = false;

  userLat: number | null = null;
  userLng: number | null = null;

  sortBy = 'relevance';
  showSortSheet = false;
  pendingSort = 'relevance';

  readonly sortOptions = [
    { value: 'relevance', label: 'Relevance (Default)' },
    { value: 'rating', label: 'Rating' },
    { value: 'distance', label: 'Distance (Nearest)' },
    { value: 'min_order_asc', label: 'Min Order: Low to High' },
  ];

  ngOnInit() {
    this.route.queryParams.subscribe(p => {
      if (p['search']) this.searchQuery = p['search'];
      this.initLocationAndLoad();
    });
  }

  initLocationAndLoad() {
    // If we already resolved location via LocationService, use it immediately
    const loc = this.locationService.location();
    if (loc) {
      this.userLat = loc.lat;
      this.userLng = loc.lng;
      this.load();
    } else {
      this.loading.set(true);
      this.locationService.initializeLocation().then(l => {
        if (l) {
          this.userLat = l.lat;
          this.userLng = l.lng;
          this.load();
        } else {
          // No location access constraints
          this.allVendors.set([]);
          this.loading.set(false);
        }
      });
    }
  }

  load() {
    if (!this.userLat || !this.userLng) {
      this.allVendors.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    // Explicitly restrict to 10 km here depending on active user location!
    const queryCat = undefined; // Shop list relies on explicit searching for now
    this.api.getNearbyVendors(this.userLat, this.userLng, 10, queryCat).subscribe({
      next: (res) => {
        const results = res.results || res;
        this.allVendors.set(results);
        const allCities = results.map((v: Vendor) => v.city).filter(Boolean);
        const unique = [...new Set<string>(allCities)] as string[];
        if (unique.length) this.cities.set(unique);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSearch() {
    // Just trigger change detection for computed signal
    // No need to query backend since vendors[] computed takes care locally
  }

  openSortSheet() { this.pendingSort = this.sortBy; this.showSortSheet = true; }

  applySort() {
    this.sortBy = this.pendingSort;
    this.showSortSheet = false;
  }

  sortLabel(): string {
    return this.sortOptions.find(o => o.value === this.sortBy)?.label || 'Sort By';
  }
}
