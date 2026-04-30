import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { SelectedLocation } from '../models';

export type UserLocation = SelectedLocation;

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private readonly guestLocationKey = 'customer_guest_location';

  // Expose the resolved location broadly
  location = signal<UserLocation | null>(null);
  
  // Track if we are currently searching for location.
  // Initially we say we're loading until we finish our first pass.
  loading = signal<boolean>(true);
  
  // A simple string representing the physical label
  locationDisplay = signal<string>('Detecting location...');

  public async initializeLocation(forceRefresh = false): Promise<UserLocation | null> {
    this.loading.set(true);

    if (!forceRefresh) {
      const stored = this.getStoredGuestLocation();
      if (stored) {
        this.location.set(stored);
        this.locationDisplay.set(stored.name);
        this.loading.set(false);
        return stored;
      }
    }

    try {
      // 1. Try Native GPS mapping via navigator
      const pos = await this.getCurrentPosition();
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      
      // We got GPS! Try to match to an address name or give a generic name
      const fallback = await this.resolveLocationMetadata(coords.lat, coords.lng);
      const res: UserLocation = {
        lat: coords.lat,
        lng: coords.lng,
        name: fallback.name,
        city: fallback.city,
        state: fallback.state,
        postalCode: fallback.postalCode,
        source: 'gps',
      };
      this.location.set(res);
      this.locationDisplay.set(res.name);
      this.persistGuestLocation(res);
      this.loading.set(false);
      return res;

    } catch (e) {
      // 2. GPS Failed or Denied. Fallback to API Address if logged in.
      if (this.auth.isLoggedIn()) {
        try {
          const fallback = await this.resolveFromAddress();
          if (fallback) {
              this.location.set(fallback);
              this.locationDisplay.set(fallback.name);
              this.persistGuestLocation(fallback);
              this.loading.set(false);
              return fallback;
          }
        } catch (addrErr) {
          // ignore error to let it fallback below
        }
      }

      // 3. Complete failure (Guest without GPS or Error)
      this.location.set(null);
      this.locationDisplay.set('Location unknown');
      this.loading.set(false);
      return null;
    }
  }

  public setManualLocation(location: UserLocation) {
    this.location.set(location);
    this.locationDisplay.set(location.name);
    this.persistGuestLocation(location);
    this.loading.set(false);
  }

  public clearStoredLocation() {
    localStorage.removeItem(this.guestLocationKey);
    this.location.set(null);
    this.locationDisplay.set('Location unknown');
  }

  private getStoredGuestLocation(): UserLocation | null {
    try {
      const raw = localStorage.getItem(this.guestLocationKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.lat !== 'number' || typeof parsed?.lng !== 'number') {
        return null;
      }
      return {
        lat: parsed.lat,
        lng: parsed.lng,
        name: parsed.name || 'Selected area',
        city: parsed.city || '',
        state: parsed.state || '',
        postalCode: parsed.postalCode || '',
        source: parsed.source || 'manual',
      };
    } catch {
      return null;
    }
  }

  private persistGuestLocation(location: UserLocation) {
    try {
      localStorage.setItem(this.guestLocationKey, JSON.stringify(location));
    } catch {
      // Ignore persistence failures and keep the in-memory location.
    }
  }

  private getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, { 
        timeout: 8000, 
        enableHighAccuracy: false 
      });
    });
  }

  private async resolveLocationMetadata(lat: number, lng: number): Promise<{
    name: string;
    city: string;
    state: string;
    postalCode: string;
  }> {
    if (!this.auth.isLoggedIn()) {
      return { name: 'Near you', city: '', state: '', postalCode: '' };
    }
    
    return new Promise(resolve => {
      this.api.getAddresses().subscribe({
        next: (r) => {
          const addrs: any[] = r.results || r;
          const nearby = addrs.find((a: any) => {
            if (!a.latitude || !a.longitude) return false;
            return this.haversine(lat, lng, parseFloat(a.latitude), parseFloat(a.longitude)) < 2;
          });
          const use = nearby || addrs.find((a: any) => a.is_default) || addrs[0];
          resolve({
            name: use?.city ? use.city : 'Near you',
            city: use?.city || '',
            state: use?.state || '',
            postalCode: use?.postal_code || '',
          });
        },
        error: () => resolve({ name: 'Near you', city: '', state: '', postalCode: '' })
      });
    });
  }

  private resolveFromAddress(): Promise<UserLocation | null> {
    return new Promise(resolve => {
      this.api.getAddresses().subscribe({
        next: (r) => {
          const addrs: any[] = r.results || r;
          const target = addrs.find((a: any) => a.is_default && a.latitude && a.longitude) 
                        || addrs.find((a: any) => a.latitude && a.longitude);
          if (target) {
            resolve({
              lat: parseFloat(target.latitude),
              lng: parseFloat(target.longitude),
              name: target.city || 'Your Address',
              city: target.city || '',
              state: target.state || '',
              postalCode: target.postal_code || '',
              source: 'saved_address',
            });
          } else {
            resolve(null);
          }
        },
        error: () => resolve(null)
      });
    });
  }

  public haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }
}
