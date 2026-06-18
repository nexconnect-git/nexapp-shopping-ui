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
import { NativePlatformService } from '../../services/native-platform.service';

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

interface PlaceSuggestionItem {
  placeId: string;
  text: string;
  mainText: string;
  secondaryText: string;
  placePrediction: any | null;
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
  @Input() initialLat = 28.6139;
  @Input() initialLng = 77.209;
  @Input() height = '300px';
  @Input() apiKey = '';
  @Input() mapId = '';
  @Output() locationPicked = new EventEmitter<MapLocation>();

  @ViewChild('mapContainer') mapContainerRef!: ElementRef;
  @ViewChild('searchInput') searchInputRef!: ElementRef;

  private platformId = inject(PLATFORM_ID);
  private ngZone = inject(NgZone);
  private googleMaps = inject(GoogleMapsService);
  private nativePlatform = inject(NativePlatformService);
  private googleMapsAuthFailureHandler = () =>
    this.ngZone.run(() => this.handleGoogleMapsAuthFailure());
  private map: any = null;
  private marker: any = null;
  private geocoder: any = null;
  private autocompleteSuggestionCtor: any = null;
  private autocompleteSessionTokenCtor: any = null;
  private autocompleteSessionToken: any = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchRequestId = 0;
  private placesApiWarned = false;

  geocoding = signal(false);
  pickedAddress = signal('');
  locating = signal(false);
  mapReady = signal(false);
  mapUnavailable = signal(false);
  currentLat = signal(this.initialLat);
  currentLng = signal(this.initialLng);
  searchQuery = signal('');
  placeSuggestions = signal<PlaceSuggestionItem[]>([]);
  searchingPlaces = signal(false);
  placesError = signal('');
  placesAutocompleteUnavailable = signal(false);
  placesAutocompleteError = signal('');

  private get resolvedApiKey() {
    return this.googleMaps.apiKey(this.apiKey);
  }

  private get resolvedMapId() {
    return this.googleMaps.mapId(this.mapId);
  }

  private get effectiveMapId() {
    return this.resolvedMapId;
  }

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    window.addEventListener(
      'nexconnect:google-maps-auth-failure',
      this.googleMapsAuthFailureHandler,
    );
    this.loadGoogleMaps();
  }

  ngOnDestroy() {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener(
        'nexconnect:google-maps-auth-failure',
        this.googleMapsAuthFailureHandler,
      );
    }
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
      .catch(() =>
        this.ngZone.run(() =>
          this.setMapUnavailable('Google Maps could not be loaded.'),
        ),
      );
  }

  private initMap() {
    const container = this.mapContainerRef?.nativeElement;
    if (!container || this.map) return;

    this.createMap(container).catch(() =>
      this.setMapUnavailable('Google Maps could not initialize.'),
    );
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

    const mapId = this.effectiveMapId;
    const mapOptions: Record<string, unknown> = {
      center,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
    };
    if (mapId) mapOptions['mapId'] = mapId;
    this.map = new MapCtor(container, mapOptions);

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
    this.mapUnavailable.set(false);
    this.refreshMapCanvas(center);

    const lat = +this.initialLat;
    const lng = +this.initialLng;
    if (lat !== 28.6139 || lng !== 77.209) {
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

  private async importGoogleLibrary(
    name: 'maps' | 'marker' | 'geocoding' | 'places',
  ) {
    if (google?.maps?.importLibrary) {
      return google.maps.importLibrary(name);
    }
    return google?.maps;
  }

  private async createMarker(position: { lat: number; lng: number }) {
    if (this.effectiveMapId) {
      const markerLibrary = await this.importGoogleLibrary('marker').catch(
        () => null,
      );
      const AdvancedMarkerElement =
        markerLibrary?.AdvancedMarkerElement ||
        google?.maps?.marker?.AdvancedMarkerElement;
      if (typeof AdvancedMarkerElement === 'function') {
        this.marker = new AdvancedMarkerElement({
          position,
          map: this.map,
          gmpDraggable: true,
        });
        return;
      }
    }

    const Marker = google?.maps?.Marker;
    if (typeof Marker !== 'function') {
      throw new Error('Google Maps marker constructor unavailable');
    }

    this.marker = new Marker({
      position,
      map: this.map,
      draggable: true,
    });
  }

  private handleGoogleMapsAuthFailure() {
    this.map = null;
    this.marker = null;
    this.geocoder = null;
    this.setMapUnavailable(
      'Google Maps rejected the API key, billing, or website referrer.',
    );
  }

  private setMarkerPosition(position: { lat: number; lng: number }) {
    this.currentLat.set(position.lat);
    this.currentLng.set(position.lng);
    if (typeof this.marker?.setPosition === 'function') {
      this.marker.setPosition(position);
      return;
    }
    this.marker.position = position;
  }

  private getMarkerPosition(): { lat: number; lng: number } | null {
    if (!this.marker) return null;
    const pos =
      typeof this.marker.getPosition === 'function'
        ? this.marker.getPosition()
        : this.marker.position;
    if (!pos) return null;
    const lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat;
    const lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng;
    return { lat: Number(lat), lng: Number(lng) };
  }

  private async ensurePlacesApiNew() {
    if (this.autocompleteSuggestionCtor && this.autocompleteSessionTokenCtor) {
      return;
    }

    const placesLibrary = await this.importGoogleLibrary('places').catch(
      () => null,
    );
    const AutocompleteSuggestion =
      placesLibrary?.AutocompleteSuggestion ||
      google?.maps?.places?.AutocompleteSuggestion;
    const AutocompleteSessionToken =
      placesLibrary?.AutocompleteSessionToken ||
      google?.maps?.places?.AutocompleteSessionToken;

    // Runtime reminder:
    // - Enable Maps JavaScript API and Places API (New)
    // - Allow Places API (New) on the key restrictions in Google Cloud
    if (
      typeof AutocompleteSuggestion !== 'function' ||
      typeof AutocompleteSessionToken !== 'function'
    ) {
      throw new Error('Places API (New) JavaScript library unavailable');
    }

    this.autocompleteSuggestionCtor = AutocompleteSuggestion;
    this.autocompleteSessionTokenCtor = AutocompleteSessionToken;
  }

  private ensureAutocompleteSessionToken() {
    if (!this.autocompleteSessionToken && this.autocompleteSessionTokenCtor) {
      this.autocompleteSessionToken = new this.autocompleteSessionTokenCtor();
    }
  }

  private clearAutocompleteSessionToken() {
    this.autocompleteSessionToken = null;
  }

  private extractErrorMessage(error: unknown): string {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (typeof error === 'object') {
      const value = error as { message?: unknown; status?: unknown };
      const messagePart =
        typeof value.message === 'string' ? value.message : '';
      const statusPart =
        typeof value.status === 'number' || typeof value.status === 'string'
          ? String(value.status)
          : '';
      return `${messagePart} ${statusPart}`.trim();
    }
    return '';
  }

  private isAutocompleteConfigError(error: unknown): boolean {
    const message = this.extractErrorMessage(error).toLowerCase();
    return (
      message.includes('403') ||
      message.includes('forbidden') ||
      message.includes('request_denied') ||
      message.includes('request denied') ||
      message.includes('blocked') ||
      message.includes('not authorized')
    );
  }

  private markAutocompleteUnavailable(error: unknown) {
    this.placesAutocompleteUnavailable.set(true);
    this.clearAutocompleteSessionToken();
    this.placeSuggestions.set([]);
    const userMessage =
      'Place search is temporarily unavailable. You can still pick a location on the map.';
    this.placesAutocompleteError.set(userMessage);
    this.placesError.set(userMessage);
    if (!this.placesApiWarned) {
      this.placesApiWarned = true;
      // A 403 from AutocompletePlaces usually means Google Cloud/API-key setup is incorrect.
      // Keep this component on Places API (New) and verify:
      // - Maps JavaScript API enabled
      // - Places API (New) enabled
      // - API key restrictions include Places API (New)
      // - Referrer allows http://localhost:4203/*
      // - Billing enabled
      console.warn(
        '[Map] Places autocomplete unavailable. Verify Places API (New), API key restrictions, referrer restrictions, and billing.',
        error,
      );
    }
  }

  private async fetchAutocompleteSuggestions(
    input: string,
  ): Promise<PlaceSuggestionItem[]> {
    await this.ensurePlacesApiNew();
    this.ensureAutocompleteSessionToken();

    const { suggestions } =
      await this.autocompleteSuggestionCtor.fetchAutocompleteSuggestions({
        input: input.trim(),
        sessionToken: this.autocompleteSessionToken,
        includedRegionCodes: ['in'],
      });

    return (suggestions || [])
      .filter((entry: any) => !!entry?.placePrediction)
      .map((entry: any) => {
        const prediction = entry.placePrediction;
        const fullText = String(prediction?.text || '').trim();
        return {
          placeId: prediction?.placeId || '',
          text: fullText,
          mainText: fullText,
          secondaryText: '',
          placePrediction: prediction,
        };
      })
      .filter((item: PlaceSuggestionItem) => !!item.placeId && !!item.text);
  }

  private async fetchPlaceDetailsFromSuggestion(
    suggestion: PlaceSuggestionItem,
  ): Promise<{
    lat: number;
    lng: number;
    formattedAddress: string;
    displayName: string;
    addressComponents: Array<{
      longText?: string;
      shortText?: string;
      types?: string[];
    }>;
  } | null> {
    await this.ensurePlacesApiNew();

    const prediction = suggestion.placePrediction;
    if (!prediction || typeof prediction.toPlace !== 'function') {
      throw new Error('Selected suggestion has no place prediction');
    }

    const place = prediction.toPlace();
    await place.fetchFields({
      fields: [
        'id',
        'displayName',
        'formattedAddress',
        'location',
        'addressComponents',
      ],
    });

    const location = place.location;
    if (!location) return null;

    const lat = typeof location.lat === 'function' ? location.lat() : null;
    const lng = typeof location.lng === 'function' ? location.lng() : null;
    if (lat === null || lng === null) return null;

    const components = Array.isArray(place.addressComponents)
      ? place.addressComponents.map((component: any) => ({
          longText: component?.longText,
          shortText: component?.shortText,
          types: Array.isArray(component?.types) ? component.types : [],
        }))
      : [];

    return {
      lat: Number(lat),
      lng: Number(lng),
      formattedAddress: String(place.formattedAddress || ''),
      displayName:
        typeof place.displayName === 'string'
          ? place.displayName
          : String(place.displayName?.text || ''),
      addressComponents: components,
    };
  }

  onSearchInput(event: Event) {
    const query = (event.target as HTMLInputElement).value;
    this.searchQuery.set(query);
    if (!this.placesAutocompleteUnavailable()) {
      this.placesError.set('');
      this.placesAutocompleteError.set('');
    }
    if (this.searchTimer) clearTimeout(this.searchTimer);

    if (query.trim().length < 3) {
      this.placeSuggestions.set([]);
      this.searchingPlaces.set(false);
      this.clearAutocompleteSessionToken();
      return;
    }

    if (this.placesAutocompleteUnavailable()) {
      this.placeSuggestions.set([]);
      this.searchingPlaces.set(false);
      this.placesError.set(
        this.placesAutocompleteError() ||
          'Place search is temporarily unavailable. You can still pick a location on the map.',
      );
      return;
    }

    const requestId = ++this.searchRequestId;
    this.searchingPlaces.set(true);
    this.searchTimer = setTimeout(() => {
      this.fetchAutocompleteSuggestions(query)
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
            if (this.isAutocompleteConfigError(error)) {
              this.markAutocompleteUnavailable(error);
              return;
            }
            this.placesError.set(
              'Location search is temporarily unavailable. Pin your location on the map.',
            );
          });
        });
    }, 250);
  }

  selectPlace(suggestion: PlaceSuggestionItem) {
    this.searchingPlaces.set(true);
    this.placesError.set('');
    this.fetchPlaceDetailsFromSuggestion(suggestion)
      .then((place) => {
        this.ngZone.run(() => {
          this.searchingPlaces.set(false);
          if (!place) {
            this.placesError.set(
              'Selected place has no coordinates. Pin your location on the map.',
            );
            return;
          }

          const lat = place.lat;
          const lng = place.lng;

          this.map.setCenter({ lat, lng });
          this.map.setZoom(16);
          this.setMarkerPosition({ lat, lng });

          const get = (type: string) =>
            place.addressComponents.find(
              (c: { types?: string[] }) => c.types?.includes(type),
            )
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
            place.addressComponents.find(
              (c: { types?: string[] }) => c.types?.includes('country'),
            )?.longText || '';
          const country_code =
            place.addressComponents.find(
              (c: { types?: string[] }) => c.types?.includes('country'),
            )?.shortText || '';

          this.pickedAddress.set(place.formattedAddress || address);
          this.searchQuery.set('');
          this.placeSuggestions.set([]);
          this.clearAutocompleteSessionToken();
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
          if (this.isAutocompleteConfigError(error)) {
            this.markAutocompleteUnavailable(error);
            return;
          }
          this.placesError.set(
            'Location details are unavailable. Pin your location on the map.',
          );
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

  async useMyLocation() {
    this.locating.set(true);

    try {
      const hasPermission = await this.nativePlatform.requestLocationPermissions();
      if (!hasPermission) {
        this.ngZone.run(() => {
          this.locating.set(false);
          this.placesError.set('Location permission was denied.');
        });
        return;
      }

      const pos = await this.nativePlatform.getCurrentPosition({
        timeout: 12000,
        enableHighAccuracy: true,
        maximumAge: 30000,
      });
      const { latitude: lat, longitude: lng } = pos.coords;
      this.ngZone.run(() => this.applyCurrentLocation(lat, lng));
    } catch {
      this.ngZone.run(() => {
        this.locating.set(false);
        this.placesError.set('Could not detect your location. Check location permission and GPS.');
      });
    }
  }

  private applyCurrentLocation(lat: number, lng: number) {
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
  }

  private setMapUnavailable(message = 'Google Maps could not be loaded.') {
    this.currentLat.set(+this.initialLat);
    this.currentLng.set(+this.initialLng);
    this.mapReady.set(false);
    this.mapUnavailable.set(true);
    this.placesError.set(message);
  }
}
