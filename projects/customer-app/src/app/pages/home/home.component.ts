import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, AuthService, Vendor } from '@shared/public-api';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, DecimalPipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);

  allVendors = signal<Vendor[]>([]);
  filteredVendors = signal<Vendor[]>([]);
  loadingVendors = signal(true);
  locationLoading = signal(false);
  locationDisplay = signal('Detecting location...');

  userLat: number | null = null;
  userLng: number | null = null;
  openOnly = false;

  selectedCategory = signal<string>('all');

  categories = signal<any[]>([
    { id: 'all', name: 'All', icon: 'grid_view', color: '#2563EB', bg: 'rgba(37,99,235,0.1)' }
  ]);

  private readonly colorMap: Record<string, any> = {
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

  loadCategories() {
    this.api.getCategories().subscribe({
      next: (res) => {
        const rawCats = res.results || res;
        const mapped = rawCats.map((c: any) => ({
          id: c.slug,
          name: c.name,
          ...(this.colorMap[c.slug] ?? { icon: 'category', color: '#4B5563', bg: 'rgba(75,85,99,0.1)' }),
        }));
        this.categories.set([
          { id: 'all', name: 'All', icon: 'grid_view', color: '#2563EB', bg: 'rgba(37,99,235,0.1)' },
          ...mapped,
        ]);
      }
    });
  }

  detectLocation() {
    if (!navigator.geolocation) {
      this.locationDisplay.set('Lagos, Nigeria');
      this.loadVendors();
      return;
    }
    this.locationLoading.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.userLat = pos.coords.latitude;
        this.userLng = pos.coords.longitude;
        this.locationLoading.set(false);
        this.resolveLocationName();
        this.loadNearbyVendors();
      },
      () => {
        this.locationLoading.set(false);
        this.locationDisplay.set('Lagos, Nigeria');
        this.loadVendors();
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }

  resolveLocationName() {
    if (!this.auth.isLoggedIn()) {
      this.locationDisplay.set('Near you');
      return;
    }
    this.api.getAddresses().subscribe({
      next: (r) => {
        const addrs: any[] = r.results || r;
        const nearby = addrs.find((a: any) => {
          if (!a.latitude || !a.longitude) return false;
          return this.haversine(this.userLat!, this.userLng!, parseFloat(a.latitude), parseFloat(a.longitude)) < 2;
        });
        const use = nearby || addrs.find((a: any) => a.is_default) || addrs[0];
        this.locationDisplay.set(use?.city ? use.city : 'Near you');
      },
      error: () => this.locationDisplay.set('Near you')
    });
  }

  loadNearbyVendors(category?: string) {
    if (!this.userLat || !this.userLng) { this.loadVendors(category); return; }
    this.loadingVendors.set(true);
    this.api.getNearbyVendors(this.userLat, this.userLng, 10, category).subscribe({
      next: (res) => {
        const vendors = (Array.isArray(res) ? res : (res.results || res)) as Vendor[];
        this.allVendors.set(vendors);
        this.filteredVendors.set(this.applyOpenFilter(vendors));
        this.loadingVendors.set(false);
      },
      error: () => this.loadVendors(category),
    });
  }

  loadVendors(category?: string) {
    this.loadingVendors.set(true);
    const params: any = {};
    if (category && category !== 'all') params['category'] = category;
    this.api.getVendors(params).subscribe({
      next: (res) => {
        let vendors = (res.results || res) as Vendor[];
        vendors = vendors.map(v => ({
          ...v,
          distance_km: v.distance_km || parseFloat((Math.random() * 8 + 0.5).toFixed(1)),
        }));
        vendors.sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));
        this.allVendors.set(vendors);
        this.filteredVendors.set(this.applyOpenFilter(vendors));
        this.loadingVendors.set(false);
      },
      error: () => this.loadingVendors.set(false),
    });
  }

  selectCategory(catId: string) {
    this.selectedCategory.set(catId);
    const cat = catId !== 'all' ? catId : undefined;
    if (this.userLat && this.userLng) {
      this.loadNearbyVendors(cat);
    } else {
      this.loadVendors(cat);
    }
    const el = document.querySelector('.stores-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  applyOpenFilter(vendors: Vendor[]): Vendor[] {
    return this.openOnly ? vendors.filter(v => v.is_open) : vendors;
  }

  toggleOpenFilter() {
    this.filteredVendors.set(this.applyOpenFilter(this.allVendors()));
  }

  get sectionTitle(): string {
    const cat = this.selectedCategoryObj;
    if (this.selectedCategory() === 'all') {
      return this.userLat ? 'Shops near you' : 'All Shops';
    }
    return cat ? `${cat.name} Stores` : 'Filtered Stores';
  }

  get selectedCategoryObj(): any {
    return this.categories().find(c => c.id === this.selectedCategory()) ?? null;
  }

  starsFor(rating: number): string {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }
}
