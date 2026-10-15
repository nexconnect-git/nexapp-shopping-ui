import { CommonModule } from '@angular/common';
import {
  afterNextRender,
  Component,
  effect,
  ElementRef,
  EventEmitter,
  inject,
  Injector,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MapLocation, MapPickerComponent } from '@shared/public-api';
import { OperatingStatusComponent } from '../../components/operating-status.component';
import { VendorStoreSettingsService } from './vendor-store-settings.service';
import { VendorStoreSettings } from './vendor-store-settings.models';
@Component({
  selector: 'nc-vendor-store-settings',
  standalone: true,
  imports: [
    OperatingStatusComponent,
    CommonModule,
    FormsModule,
    MapPickerComponent,
    RouterLink,
  ],
  templateUrl: './vendor-store-settings.component.html',
  styleUrl: './vendor-store-settings.component.scss',
})
export class VendorStoreSettingsComponent implements OnInit {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly injector = inject(Injector);
  @Output() saved = new EventEmitter<void>();
  readonly mapVisible = signal(false);
  readonly activeSection = signal('Store profile');
  readonly sectionNames = ['Store profile','Pickup address','Hours and intake','Delivery','Account and security','Verification'];
  readonly sections = [
    {
      title: 'Store profile',
      fields: [
        { key: 'storeName', label: 'Store name', type: 'text' },
        { key: 'phone', label: 'Business phone', type: 'tel' },
        { key: 'email', label: 'Public email', type: 'email' },
      ],
    },
    {
      title: 'Hours and intake',
      fields: [
        { key: 'openingTime', label: 'Opening time', type: 'time' },
        { key: 'closingTime', label: 'Closing time', type: 'time' },

      ],
    },
    { title: 'Delivery', fields: [
        { key: 'minimumOrder', label: 'Minimum order amount', type: 'number' },
        {
          key: 'basePrepMinutes',
          label: 'Base preparation minutes',
          type: 'number',
        },
        {
          key: 'deliveryRadiusKm',
          label: 'Delivery radius (km)',
          type: 'number',
        },
        {
          key: 'instantRadiusKm',
          label: 'Instant radius (km)',
          type: 'number',
        },
      ] },
    {
      title: 'Pickup address',
      fields: [
        { key: 'address', label: 'Street address', type: 'text' },
        { key: 'city', label: 'City', type: 'text' },
        { key: 'state', label: 'State', type: 'text' },
        { key: 'postalCode', label: 'Postal code', type: 'text' },
        { key: 'latitude', label: 'Latitude', type: 'number' },
        { key: 'longitude', label: 'Longitude', type: 'number' },
      ],
    },
  ];
  readonly service = inject(VendorStoreSettingsService);
  constructor() {
    effect(() => {
      const errors = this.service.errors();
      for (const section of this.sections) {
        const keys = [
          ...section.fields.map((field) => field.key),
          ...(section.title === 'Store profile' ? ['description'] : []),
        ];
        if (keys.some((key) => !!errors[key])) { this.activeSection.set(section.title); break; }
      }
    });
  }
  ngOnInit(): void {
    void this.service.load();
    void this.service.loadAccount();
  }
  value(key: string): unknown {
    return this.service.settings()[key as keyof VendorStoreSettings];
  }
  error(key: string): string {
    return this.service.fieldError(key as keyof VendorStoreSettings);
  }
  update(key: string, value: unknown): void {
    const numeric = [
      'minimumOrder',
      'basePrepMinutes',
      'deliveryRadiusKm',
      'instantRadiusKm',
      'latitude',
      'longitude',
    ].includes(key);
    this.service.patch({
      [key]: numeric
        ? value === null || value === ''
          ? null
          : Number(value)
        : value,
    } as Partial<VendorStoreSettings>);
  }
  onLocationPicked(location: MapLocation): void {
    this.service.selectMapLocation(location);
  }
  async save(): Promise<void> {
    if (await this.service.save()) this.saved.emit();
    else afterNextRender(() => { const field = this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]'); field?.focus(); field?.scrollIntoView({block:'center'}); }, {injector:this.injector});
  }
}
