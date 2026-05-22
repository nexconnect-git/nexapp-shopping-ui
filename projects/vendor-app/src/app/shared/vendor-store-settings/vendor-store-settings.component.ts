import { NgFor, NgIf } from '@angular/common';
import {
  Component,
  OnInit,
  computed,
  EventEmitter,
  Output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MapLocation, MapPickerComponent } from '@shared/public-api';
import { VendorStoreSettingsService } from './vendor-store-settings.service';

@Component({
  selector: 'nc-vendor-store-settings',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, MapPickerComponent],
  templateUrl: './vendor-store-settings.component.html',
  styleUrls: ['./vendor-store-settings.component.scss'],
})
export class VendorStoreSettingsComponent implements OnInit {
  @Output() saved = new EventEmitter<void>();

  readonly mapVisible = signal(false);
  readonly locationQuery = signal('');

  readonly statusCards = computed(() =>
    this.service.getStatusCards(this.service.savedSettings()),
  );

  readonly filteredLocations = computed(() => {
    const query = this.locationQuery().trim().toLowerCase();
    if (!query) return this.service.locationSuggestions;

    return this.service.locationSuggestions.filter((item) =>
      `${item.label} ${item.address} ${item.city} ${item.state}`
        .toLowerCase()
        .includes(query),
    );
  });

  constructor(public service: VendorStoreSettingsService) {}

  ngOnInit(): void {
    void this.service.load();
  }

  update(key: string, value: unknown): void {
    this.service.patch({ [key]: value } as never);
  }

  toggle(key: 'storeOpen' | 'acceptingOrders' | 'autoAcceptOrders'): void {
    this.service.patch({ [key]: !this.service.settings()[key] });
  }

  useMyLocation(): void {
    void this.service.useMyLocation();
  }

  onLocationPicked(location: MapLocation): void {
    this.service.selectMapLocation(location);
  }

  async save(): Promise<void> {
    const saved = await this.service.save();
    if (saved) this.saved.emit();
  }
}
