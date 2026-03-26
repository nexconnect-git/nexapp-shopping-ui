import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnDestroy,
  AfterViewInit,
  signal,
  ElementRef,
  ViewChild,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

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
  imports: [CommonModule],
  templateUrl: './map-picker.component.html',
  styleUrl: './map-picker.component.scss',
})
export class MapPickerComponent implements AfterViewInit, OnDestroy {
  @Input() initialLat = 6.5244;
  @Input() initialLng = 3.3792;
  @Input() height = '300px';
  @Output() locationPicked = new EventEmitter<MapLocation>();

  @ViewChild('mapContainer') mapContainerRef!: ElementRef;

  private platformId = inject(PLATFORM_ID);
  private map: any = null;
  private marker: any = null;
  private geocoder: any = null;

  geocoding = signal(false);
  pickedAddress = signal('');
  locating = signal(false);
  mapReady = signal(false);

  private readonly API_KEY = 'AIzaSyA2Uv9QDNG9IuDfJ70MuuMm-XMyXDEBUBA';

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.loadGoogleMaps();
  }

  ngOnDestroy() {
    this.map = null;
    this.marker = null;
    this.geocoder = null;
  }

  private loadGoogleMaps() {
    if (typeof google !== 'undefined' && google.maps) {
      this.initMap();
      return;
    }
    const existing = document.getElementById('google-maps-js');
    if (!existing) {
      const script = document.createElement('script');
      script.id = 'google-maps-js';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.API_KEY}`;
      script.async = true;
      script.defer = true;
      script.onload = () => this.initMap();
      document.head.appendChild(script);
    } else {
      const interval = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps) {
          clearInterval(interval);
          this.initMap();
        }
      }, 50);
      setTimeout(() => clearInterval(interval), 10000);
    }
  }

  private initMap() {
    const container = this.mapContainerRef?.nativeElement;
    if (!container || this.map) return;

    const center = { lat: this.initialLat, lng: this.initialLng };

    this.map = new google.maps.Map(container, {
      center,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    this.marker = new google.maps.Marker({
      position: center,
      map: this.map,
      draggable: true,
    });

    this.geocoder = new google.maps.Geocoder();

    this.marker.addListener('dragend', () => {
      const pos = this.marker.getPosition();
      this.reverseGeocode(pos.lat(), pos.lng());
    });

    this.map.addListener('click', (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      this.marker.setPosition({ lat, lng });
      this.reverseGeocode(lat, lng);
    });

    this.mapReady.set(true);

    if (this.initialLat !== 6.5244 || this.initialLng !== 3.3792) {
      this.reverseGeocode(this.initialLat, this.initialLng);
    }
  }

  private reverseGeocode(lat: number, lng: number) {
    this.geocoding.set(true);
    this.geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
      this.geocoding.set(false);
      if (status === 'OK' && results?.length > 0) {
        const result = results[0];
        const components: any[] = result.address_components || [];
        const get = (type: string) =>
          components.find((c) => c.types.includes(type))?.long_name || '';

        const address =
          [get('street_number'), get('route'), get('sublocality_level_1')]
            .filter(Boolean)
            .join(' ') ||
          result.formatted_address.split(',').slice(0, 2).join(',');

        const city = get('locality') || get('administrative_area_level_2');
        const state = get('administrative_area_level_1');
        const postal_code = get('postal_code');

        this.pickedAddress.set(result.formatted_address || '');
        this.locationPicked.emit({ lat, lng, address, city, state, postal_code });
      } else {
        this.locationPicked.emit({ lat, lng, address: '', city: '', state: '', postal_code: '' });
      }
    });
  }

  useMyLocation() {
    if (!navigator.geolocation) return;
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        this.locating.set(false);
        if (this.map && this.marker) {
          this.map.setCenter({ lat, lng });
          this.map.setZoom(15);
          this.marker.setPosition({ lat, lng });
          this.reverseGeocode(lat, lng);
        }
      },
      () => this.locating.set(false),
      { timeout: 8000, enableHighAccuracy: false }
    );
  }
}
