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
import {
  autocompleteGooglePlaces,
  DEFAULT_GOOGLE_MAPS_API_KEY,
  getGooglePlaceDetails,
  GooglePlaceSuggestion,
} from '../../utils/google-api';

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
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchRequestId = 0;

  geocoding = signal(false);
  pickedAddress = signal('');
  locating = signal(false);
  mapReady = signal(false);
  searchQuery = signal('');
  placeSuggestions = signal<GooglePlaceSuggestion[]>([]);
  searchingPlaces = signal(false);
  placesError = signal('');

  private readonly API_KEY = DEFAULT_GOOGLE_MAPS_API_KEY;

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.loadGoogleMaps();
  }

  ngOnDestroy() {
    this.map = null;
    this.marker = null;
    this.geocoder = null;
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  private loadGoogleMaps() {
    const src = `https://maps.googleapis.com/maps/api/js?key=${this.API_KEY}`;

    if (typeof google !== 'undefined' && google.maps) {
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
      const interval = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps) {
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

    this.mapReady.set(true);

    const lat = +this.initialLat;
    const lng = +this.initialLng;
    if (lat !== 6.5244 || lng !== 3.3792) {
      this.reverseGeocode(lat, lng);
    }
  }

  onSearchInput(event: Event) {
    const query = (event.target as HTMLInputElement).value;
    this.searchQuery.set(query);
    this.placesError.set('');
    if (this.searchTimer) clearTimeout(this.searchTimer);

    if (query.trim().length < 3) {
      this.placeSuggestions.set([]);
      this.searchingPlaces.set(false);
      return;
    }

    const requestId = ++this.searchRequestId;
    this.searchingPlaces.set(true);
    this.searchTimer = setTimeout(() => {
      autocompleteGooglePlaces(this.API_KEY, query)
        .then((suggestions) => {
          this.ngZone.run(() => {
            if (requestId !== this.searchRequestId) return;
            this.placeSuggestions.set(suggestions);
            this.searchingPlaces.set(false);
          });
        })
        .catch((error) => {
          this.ngZone.run(() => {
            if (requestId !== this.searchRequestId) return;
            this.placeSuggestions.set([]);
            this.searchingPlaces.set(false);
            this.placesError.set('Location search is unavailable right now.');
            console.warn('[Map] Places API (New) unavailable:', error);
          });
        });
    }, 250);
  }

  selectPlace(suggestion: GooglePlaceSuggestion) {
    this.searchingPlaces.set(true);
    this.placesError.set('');
    getGooglePlaceDetails(this.API_KEY, suggestion.placeId)
      .then((place) => {
        this.ngZone.run(() => {
          this.searchingPlaces.set(false);
          if (!place) return;

          const lat = place.lat;
          const lng = place.lng;

          this.map.setCenter({ lat, lng });
          this.map.setZoom(16);
          this.marker.setPosition({ lat, lng });

          const get = (type: string) =>
            place.addressComponents.find((c) => c.types?.includes(type))?.longText || '';

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
            place.formattedAddress.split(',')[0]?.trim() ||
            place.displayName ||
            '';

          const city = get('locality') || get('administrative_area_level_2');
          const state = get('administrative_area_level_1');
          const postal_code = get('postal_code');

          this.pickedAddress.set(place.formattedAddress || address);
          this.searchQuery.set('');
          this.placeSuggestions.set([]);
          this.locationPicked.emit({
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
            address, city, state, postal_code,
          });
        });
      })
      .catch((error) => {
        this.ngZone.run(() => {
          this.searchingPlaces.set(false);
          this.placesError.set('Could not load that location.');
          console.warn('[Map] Place details unavailable:', error);
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
