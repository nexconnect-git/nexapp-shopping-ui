import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  NgZone,
  OnDestroy,
  Output,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoogleMapsService } from '../../services/google-maps.service';
import {
  autocompleteGooglePlaces,
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
  country?: string;
  country_code?: string;
}

declare const google: any;
@Component({
  selector: 'app-map-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map-picker.component.html',
  styleUrl: './map-picker.component.scss',
})
export class MapPickerComponent implements AfterViewInit, OnDestroy {
  @Input() initialLat = 6.5244;
  @Input() initialLng = 3.3792;
  @Input() height = '300px';
  @Input() apiKey = '';
  @Input() mapId = '';
  @Output() locationPicked = new EventEmitter<MapLocation>();

  @ViewChild('mapContainer') mapContainerRef!: ElementRef;
  @ViewChild('searchInput') searchInputRef!: ElementRef;

  private platformId = inject(PLATFORM_ID);
  private ngZone = inject(NgZone);
  private googleMaps = inject(GoogleMapsService);
  private map: any = null;
  private marker: any = null;
  private geocoder: any = null;
  private markerKind: 'legacy' | 'advanced' = 'legacy';
  private advancedMarkersEnabled = false;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchRequestId = 0;

  geocoding = signal(false);
  pickedAddress = signal('');
  locating = signal(false);
  mapReady = signal(false);
  mapUnavailable = signal(false);
  currentLat = signal(this.initialLat);
  currentLng = signal(this.initialLng);
  searchQuery = signal('');
  placeSuggestions = signal<GooglePlaceSuggestion[]>([]);
  searchingPlaces = signal(false);
  placesError = signal('');

  private get resolvedApiKey() {
    return this.googleMaps.apiKey(this.apiKey);
  }

  private get resolvedMapId() {
    return this.googleMaps.mapId(this.mapId);
  }

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
    const apiKey = this.resolvedApiKey;
    if (!apiKey) {
      this.setMapUnavailable('Google Maps API key is not configured.');
      return;
    }

    this.googleMaps
      .loadJavaScriptApi(apiKey)
      .then(() => this.ngZone.run(() => this.initMap()))
      .catch(() => this.ngZone.run(() => this.setMapUnavailable()));
  }

  private initMap() {
    const container = this.mapContainerRef?.nativeElement;
    if (!container || this.map) return;

    this.createMap(container).catch(() => this.setMapUnavailable());
  }

  private async createMap(container: HTMLElement) {
    const center = { lat: +this.initialLat, lng: +this.initialLng };
    this.currentLat.set(center.lat);
    this.currentLng.set(center.lng);
    const mapsLibrary = await this.importGoogleLibrary('maps');
    const MapCtor = mapsLibrary?.Map || google?.maps?.Map;
    if (typeof MapCtor !== 'function') {
      throw new Error('Google Maps Map constructor unavailable');
    }

    const mapId = this.resolvedMapId;
    this.advancedMarkersEnabled = !!mapId;
    this.map = new MapCtor(container, {
      center,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
      ...(mapId ? { mapId } : {}),
    });

    await this.createMarker(center);

    const geocodingLibrary = await this.importGoogleLibrary('geocoding');
    const GeocoderCtor = geocodingLibrary?.Geocoder || google?.maps?.Geocoder;
    if (typeof GeocoderCtor !== 'function') {
      throw new Error('Google Maps geocoder constructor unavailable');
    }
    this.geocoder = new GeocoderCtor();

    this.marker.addListener('dragend', () => {
      const pos = this.getMarkerPosition();
      if (pos) this.ngZone.run(() => this.reverseGeocode(pos.lat, pos.lng));
    });

    this.map.addListener('click', (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      this.setMarkerPosition({ lat, lng });
      this.ngZone.run(() => this.reverseGeocode(lat, lng));
    });

    this.mapReady.set(true);
    this.refreshMapCanvas(center);

    const lat = +this.initialLat;
    const lng = +this.initialLng;
    if (lat !== 6.5244 || lng !== 3.3792) {
      this.reverseGeocode(lat, lng);
    }
  }

  private refreshMapCanvas(center: { lat: number; lng: number }) {
    [0, 150, 400].forEach((delay) => {
      window.setTimeout(() => {
        if (!this.map) return;
        google?.maps?.event?.trigger?.(this.map, 'resize');
        this.map.setCenter(center);
      }, delay);
    });
  }

  private async importGoogleLibrary(name: 'maps' | 'marker' | 'geocoding') {
    if (google?.maps?.importLibrary) {
      return google.maps.importLibrary(name);
    }
    return google?.maps;
  }

  private async createMarker(position: { lat: number; lng: number }) {
    if (this.advancedMarkersEnabled) {
      const markerLibrary = await this.importGoogleLibrary('marker').catch(
        () => null,
      );
      const AdvancedMarkerElement =
        markerLibrary?.AdvancedMarkerElement ||
        google?.maps?.marker?.AdvancedMarkerElement;
      if (typeof AdvancedMarkerElement === 'function') {
        this.markerKind = 'advanced';
        this.marker = new AdvancedMarkerElement({
          position,
          map: this.map,
          gmpDraggable: true,
        });
        return;
      }
    }

    if (typeof google?.maps?.Marker === 'function') {
      this.markerKind = 'legacy';
      this.marker = new google.maps.Marker({
        position,
        map: this.map,
        draggable: true,
        animation: google.maps.Animation?.DROP,
      });
      return;
    }
    throw new Error('Google Maps marker constructor unavailable');
  }

  private setMarkerPosition(position: { lat: number; lng: number }) {
    this.currentLat.set(position.lat);
    this.currentLng.set(position.lng);
    if (this.markerKind === 'legacy') {
      this.marker.setPosition(position);
    } else {
      this.marker.position = position;
    }
  }

  private getMarkerPosition(): { lat: number; lng: number } | null {
    if (!this.marker) return null;
    if (this.markerKind === 'legacy') {
      const pos = this.marker.getPosition();
      return pos ? { lat: pos.lat(), lng: pos.lng() } : null;
    }
    const pos = this.marker.position;
    if (!pos) return null;
    const lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat;
    const lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng;
    return { lat: Number(lat), lng: Number(lng) };
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
      autocompleteGooglePlaces(this.resolvedApiKey, query)
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
    getGooglePlaceDetails(this.resolvedApiKey, suggestion.placeId)
      .then((place) => {
        this.ngZone.run(() => {
          this.searchingPlaces.set(false);
          if (!place) return;

          const lat = place.lat;
          const lng = place.lng;

          this.map.setCenter({ lat, lng });
          this.map.setZoom(16);
          this.setMarkerPosition({ lat, lng });

          const get = (type: string) =>
            place.addressComponents.find((c) => c.types?.includes(type))
              ?.longText || '';

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
          const country =
            place.addressComponents.find((c) => c.types?.includes('country'))
              ?.longText || '';
          const country_code =
            place.addressComponents.find((c) => c.types?.includes('country'))
              ?.shortText || '';

          this.pickedAddress.set(place.formattedAddress || address);
          this.searchQuery.set('');
          this.placeSuggestions.set([]);
          this.locationPicked.emit({
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
            address,
            city,
            state,
            postal_code,
            country,
            country_code,
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
    this.geocoder.geocode(
      { location: { lat, lng } },
      (results: any[], status: string) => {
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
            const country = get('country');
            const country_code =
              components.find((c) => c.types.includes('country'))
                ?.short_name || '';

            this.pickedAddress.set(result.formatted_address || '');
            this.locationPicked.emit({
              lat: Number(lat.toFixed(6)),
              lng: Number(lng.toFixed(6)),
              address,
              city,
              state,
              postal_code,
              country,
              country_code,
            });
          } else {
            this.locationPicked.emit({
              lat: Number(lat.toFixed(6)),
              lng: Number(lng.toFixed(6)),
              address: '',
              city: '',
              state: '',
              postal_code: '',
            });
          }
        });
      },
    );
  }

  useMyLocation() {
    if (!navigator.geolocation) return;
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        this.ngZone.run(() => {
          this.locating.set(false);
          this.currentLat.set(Number(lat.toFixed(6)));
          this.currentLng.set(Number(lng.toFixed(6)));
          if (this.map && this.marker) {
            this.map.setCenter({ lat, lng });
            this.map.setZoom(16);
            this.setMarkerPosition({ lat, lng });
            this.reverseGeocode(lat, lng);
          } else {
            this.pickedAddress.set(
              `Pinned location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            );
            this.locationPicked.emit({
              lat: Number(lat.toFixed(6)),
              lng: Number(lng.toFixed(6)),
              address: '',
              city: '',
              state: '',
              postal_code: '',
            });
          }
        });
      },
      () => this.ngZone.run(() => this.locating.set(false)),
      { timeout: 8000, enableHighAccuracy: true },
    );
  }

  private setMapUnavailable(message = 'Google Maps could not be loaded.') {
    this.currentLat.set(+this.initialLat);
    this.currentLng.set(+this.initialLng);
    this.mapUnavailable.set(true);
    this.placesError.set(message);
  }
}
