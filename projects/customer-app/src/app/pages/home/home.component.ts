import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, AuthService, Category, Vendor, LocationService } from '@shared/public-api';

interface DisplayCategory {
  id: string;       // slug — used for vendor filtering
  uuid: string;     // UUID — used to look up children
  name: string;
  icon: string;
  color: string;
  bg: string;
  children: DisplayCategory[];
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, DecimalPipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  auth = inject(AuthService);
  locationService = inject(LocationService);
  private api = inject(ApiService);

  allVendors = signal<Vendor[]>([]);
  filteredVendors = signal<Vendor[]>([]);
  loadingVendors = signal(true);

  locationLoading = this.locationService.loading;
  locationDisplay = this.locationService.locationDisplay;

  userLat: number | null = null;
  userLng: number | null = null;
  openOnly = false;

  selectedCategory = signal<string>('all');     // slug or 'all'
  selectedSubCategory = signal<string | null>(null);  // slug or null

  topPicks = computed(() => {
    const featured = this.allVendors().filter(v => v.is_featured);
    if (featured.length >= 3) return featured.slice(0, 10);
    return [...this.allVendors()].sort((a, b) => b.average_rating - a.average_rating).slice(0, 10);
  });

  categories = signal<DisplayCategory[]>([
    { id: 'all', uuid: '', name: 'All', icon: 'grid_view', color: '#2563EB', bg: 'rgba(37,99,235,0.1)', children: [] }
  ]);

  /** Subcategories of the currently selected root category */
  currentSubcategories = computed<DisplayCategory[]>(() => {
    if (this.selectedCategory() === 'all') return [];
    return this.categories().find(c => c.id === this.selectedCategory())?.children ?? [];
  });

  private readonly colorMap: Record<string, { icon: string; color: string; bg: string }> = {
    'nigerian-food':  { icon: 'restaurant',          color: '#F97316', bg: 'rgba(249,115,22,0.1)' },
    'continental':    { icon: 'local_bar',            color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
    'fresh-produce':  { icon: 'eco',                  color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    'electronics':    { icon: 'devices',              color: '#06B6D4', bg: 'rgba(6,182,212,0.1)' },
    'fashion':        { icon: 'checkroom',            color: '#EC4899', bg: 'rgba(236,72,153,0.1)' },
    'food':           { icon: 'restaurant',           color: '#F97316', bg: 'rgba(249,115,22,0.1)' },
    'groceries':      { icon: 'local_grocery_store',  color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    'pharmacy':       { icon: 'local_pharmacy',       color: '#2563EB', bg: 'rgba(37,99,235,0.1)' },
    'bakery':         { icon: 'bakery_dining',        color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  };

  ngOnInit() {
    this.loadCategories();
    this.detectLocation();
  }

  private mapCategory(c: Category): DisplayCategory {
    const style = this.colorMap[c.slug] ?? { icon: 'category', color: '#4B5563', bg: 'rgba(75,85,99,0.1)' };
    return {
      id: c.slug,
      uuid: c.id,
      name: c.name,
      ...style,
      children: (c.children ?? []).map(ch => this.mapCategory(ch)),
    };
  }

  loadCategories() {
    this.api.getCategories().subscribe({
      next: (res) => {
        const rawCats: Category[] = res.results || res;
        const mapped = rawCats.map(c => this.mapCategory(c));
        this.categories.set([
          { id: 'all', uuid: '', name: 'All', icon: 'grid_view', color: '#2563EB', bg: 'rgba(37,99,235,0.1)', children: [] },
          ...mapped,
        ]);
      }
    });
  }

  detectLocation() {
    this.locationService.initializeLocation().then(loc => {
      if (loc) {
        this.userLat = loc.lat;
        this.userLng = loc.lng;
        this.loadNearbyVendors();
      } else {
        this.allVendors.set([]);
        this.filteredVendors.set([]);
        this.loadingVendors.set(false);
      }
    });
  }

  loadNearbyVendors(category?: string) {
    if (!this.userLat || !this.userLng) {
      this.allVendors.set([]);
      this.filteredVendors.set([]);
      this.loadingVendors.set(false);
      return;
    }
    this.loadingVendors.set(true);
    this.api.getNearbyVendors(this.userLat, this.userLng, 10, category).subscribe({
      next: (res) => {
        const vendors = (Array.isArray(res) ? res : (res.results || res)) as Vendor[];
        this.allVendors.set(vendors);
        this.filteredVendors.set(this.applyOpenFilter(vendors));
        this.loadingVendors.set(false);
      },
      error: () => this.loadingVendors.set(false)
    });
  }

  selectCategory(catId: string) {
    this.selectedCategory.set(catId);
    this.selectedSubCategory.set(null);
    const cat = catId !== 'all' ? catId : undefined;
    this.loadNearbyVendors(cat);
    const el = document.querySelector('.stores-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  selectSubCategory(subSlug: string | null) {
    this.selectedSubCategory.set(subSlug);
    // Filter vendor list by sub-category slug (backend supports parent OR child slug)
    const filterSlug = subSlug ?? this.selectedCategory();
    this.loadNearbyVendors(filterSlug !== 'all' ? filterSlug : undefined);
  }

  applyOpenFilter(vendors: Vendor[]): Vendor[] {
    return this.openOnly ? vendors.filter(v => v.is_open) : vendors;
  }

  toggleOpenFilter() {
    this.filteredVendors.set(this.applyOpenFilter(this.allVendors()));
  }

  get sectionTitle(): string {
    const sub = this.selectedSubCategory();
    const cat = this.selectedCategoryObj;
    if (this.selectedCategory() === 'all') return this.userLat ? 'Shops near you' : 'All Shops';
    if (sub) {
      const subObj = this.currentSubcategories().find(c => c.id === sub);
      return subObj ? `${subObj.name} Shops` : 'Filtered Shops';
    }
    return cat ? `${cat.name} Shops` : 'Filtered Shops';
  }

  get selectedCategoryObj(): DisplayCategory | null {
    return this.categories().find(c => c.id === this.selectedCategory()) ?? null;
  }

  starsFor(rating: number): string {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }
}
