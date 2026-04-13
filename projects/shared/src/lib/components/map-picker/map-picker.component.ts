import {
  Component,
  Input,
  Output,
  EventEmitter,
  NgZone,
  OnDestroy,
  AfterViewInit,
  signal,
  ElementRef,
  ViewChild,
  PLATFORM_ID,
  inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface MapLocation {
  lat: number;
  lng: number;
  address: string;
  city: string;
  state: string;
  postal_code: string;
}

declare const google: any;

@Component({
  selector: 'app-map-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map-picker.component.html',
  styleUrl: './map-picker.component.scss' })
export class MapPickerComponent implements AfterViewInit, OnDestroy {
  @Input() initialLat = 6.5244;
  @Input() initialLng = 3.3792;
  @Input() height = '300px';
  @Output() locationPicked = new EventEmitter<MapLocation>();

  @ViewChild('mapContainer') mapContainerRef!: ElementRef;
  @ViewChild('searchInput') searchInputRef!: ElementRef;

  private platformId = inject(PLATFORM_ID);
  private ngZone = inject(NgZone);
  private map: any = null;
  private marker: any = null;
  private geocoder: any = null;
  private autocomplete: any = null;

  geocoding = signal(false);
  pickedAddress = signal('');
  locating = signal(false);
  mapReady = signal(false);
  searchQuery = signal('');

  private readonly API_KEY = 'AIzaSyA2Uv9QDNG9IuDfJ70MuuMm-XMyXDEBUBA';

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.loadGoogleMaps();
  }

  ngOnDestroy() {
    this.map = null;
    this.marker = null;
    this.geocoder = null;
    this.autocomplete = null;
  }

  private loadGoogleMaps() {
    // Include the 'places' library for autocomplete search
    const src = `https://maps.googleapis.com/maps/api/js?key=${this.API_KEY}&libraries=places`;

    if (typeof google !== 'undefined' && google.maps && google.maps.places) {
      this.initMap();
      return;
    }

    const existing = document.getElementById('google-maps-js');
    if (!existing) {
      const script = document.createElement('script');
      script.id = 'google-maps-js';
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = () => this.ngZone.run(() => this.initMap());
      document.head.appendChild(script);
    } else {
      // Script tag exists but may not have places — replace it
      const hasSrc = existing.getAttribute('src') || '';
      if (!hasSrc.includes('places')) {
        existing.setAttribute('src', src);
      }
      const interval = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps && google.maps.places) {
          clearInterval(interval);
          this.ngZone.run(() => this.initMap());
        }
      }, 50);
      setTimeout(() => clearInterval(interval), 10000);
    }
  }

  private initMap() {
    const container = this.mapContainerRef?.nativeElement;
    if (!container || this.map) return;

    const center = { lat: +this.initialLat, lng: +this.initialLng };

    this.map = new google.maps.Map(container, {
      center,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
    });

    this.marker = new google.maps.Marker({
      position: center,
      map: this.map,
      draggable: true,
      animation: google.maps.Animation.DROP,
    });

    this.geocoder = new google.maps.Geocoder();

    // Drag-end: update on marker drag
    this.marker.addListener('dragend', () => {
      const pos = this.marker.getPosition();
      this.ngZone.run(() => this.reverseGeocode(pos.lat(), pos.lng()));
    });

    // Click: move marker to clicked location
    this.map.addListener('click', (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      this.marker.setPosition({ lat, lng });
      this.ngZone.run(() => this.reverseGeocode(lat, lng));
    });

    // Set up Places Autocomplete on the search box
    this.initAutocomplete();

    this.mapReady.set(true);

    const lat = +this.initialLat;
    const lng = +this.initialLng;
    if (lat !== 6.5244 || lng !== 3.3792) {
      this.reverseGeocode(lat, lng);
    }
  }

  private initAutocomplete() {
    const input = this.searchInputRef?.nativeElement;
    if (!input || !google.maps.places) return;

    this.autocomplete = new google.maps.places.Autocomplete(input, {
      fields: ['geometry', 'formatted_address', 'address_components', 'name'],
    });

    this.autocomplete.addListener('place_changed', () => {
      this.ngZone.run(() => {
        const place = this.autocomplete.getPlace();
        if (!place.geometry?.location) return;

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        this.map.setCenter({ lat, lng });
        this.map.setZoom(16);
        this.marker.setPosition({ lat, lng });

        // Build address from the place's address_components directly
        const components: any[] = place.address_components || [];
        const get = (type: string) =>
          components.find((c: any) => c.types.includes(type))?.long_name || '';

        const streetParts = [
          get('street_number'),
          get('route'),
          get('premise'),
          get('sublocality_level_2'),
          get('sublocality_level_1'),
          get('neighborhood'),
        ].filter(Boolean);

        const address =
          streetParts.join(' ') ||
          place.formatted_address?.split(',')[0]?.trim() ||
          place.name ||
          '';

        const city = get('locality') || get('administrative_area_level_2');
        const state = get('administrative_area_level_1');
        const postal_code = get('postal_code');

        this.pickedAddress.set(place.formatted_address || address);
        this.searchQuery.set('');
        this.locationPicked.emit({
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
          address, city, state, postal_code,
        });
      });
    });
  }

  private reverseGeocode(lat: number, lng: number) {
    this.geocoding.set(true);
    this.geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
      this.ngZone.run(() => {
        this.geocoding.set(false);
        if (status === 'OK' && results?.length > 0) {
          const result = results[0];
          const components: any[] = result.address_components || [];
          const get = (type: string) =>
            components.find((c) => c.types.includes(type))?.long_name || '';

          const streetParts = [
            get('street_number'),
            get('route'),
            get('premise'),
            get('sublocality_level_2'),
            get('sublocality_level_1'),
            get('neighborhood'),
          ].filter(Boolean);

          const address =
            streetParts.join(' ') ||
            result.formatted_address.split(',')[0].trim();

          const city = get('locality') || get('administrative_area_level_2');
          const state = get('administrative_area_level_1');
          const postal_code = get('postal_code');

          this.pickedAddress.set(result.formatted_address || '');
          this.locationPicked.emit({
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
            address, city, state, postal_code,
          });
        } else {
          this.locationPicked.emit({
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
            address: '', city: '', state: '', postal_code: '',
          });
        }
      });
    });
  }

  useMyLocation() {
    if (!navigator.geolocation) return;
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        this.ngZone.run(() => {
          this.locating.set(false);
          if (this.map && this.marker) {
            this.map.setCenter({ lat, lng });
            this.map.setZoom(16);
            this.marker.setPosition({ lat, lng });
            this.reverseGeocode(lat, lng);
          }
        });
      },
      () => this.ngZone.run(() => this.locating.set(false)),
      { timeout: 8000, enableHighAccuracy: true }
    );
  }
}
