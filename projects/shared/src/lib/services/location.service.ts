import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

export interface UserLocation {
  lat: number;
  lng: number;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  // Expose the resolved location broadly
  location = signal<UserLocation | null>(null);
  
  // Track if we are currently searching for location.
  // Initially we say we're loading until we finish our first pass.
  loading = signal<boolean>(true);
  
  // A simple string representing the physical label
  locationDisplay = signal<string>('Detecting location...');

  public async initializeLocation(): Promise<UserLocation | null> {
    this.loading.set(true);

    try {
      // 1. Try Native GPS mapping via navigator
      const pos = await this.getCurrentPosition();
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      
      // We got GPS! Try to match to an address name or give a generic name
      const locName = await this.resolveNameFromCoords(coords.lat, coords.lng);
      
      const res = { lat: coords.lat, lng: coords.lng, name: locName };
      this.location.set(res);
      this.locationDisplay.set(locName);
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

  private async resolveNameFromCoords(lat: number, lng: number): Promise<string> {
    if (!this.auth.isLoggedIn()) return 'Near you';
    
    return new Promise(resolve => {
      this.api.getAddresses().subscribe({
        next: (r) => {
          const addrs: any[] = r.results || r;
          const nearby = addrs.find((a: any) => {
            if (!a.latitude || !a.longitude) return false;
            return this.haversine(lat, lng, parseFloat(a.latitude), parseFloat(a.longitude)) < 2;
          });
          const use = nearby || addrs.find((a: any) => a.is_default) || addrs[0];
          resolve(use?.city ? use.city : 'Near you');
        },
        error: () => resolve('Near you')
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
              name: target.city || 'Your Address'
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
