import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../../models';

type StoreMeta = Record<string, unknown> & {
  is_open_now?: boolean;
  is_open?: boolean;
  opening_time?: string;
  closing_time?: string;
};

@Component({
  selector: 'fd-store-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './store-card.component.html',
  styleUrls: ['./store-card.component.scss'],
})
export class StoreCardComponent {
  @Input({ required: true }) store!: Store;
  readonly placeholderImage = '/assets/placeholders/store.svg';

  storeName(): string {
    return this.store?.name?.trim() || 'Store unavailable';
  }

  ratingLabel(): string {
    const rating = Number(this.store?.rating);
    return Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : 'New';
  }

  ratingsCountLabel(): string {
    return this.store?.ratings?.toString().trim() || '0';
  }

  etaLabel(): string {
    return this.store?.eta?.trim() || 'ETA unavailable';
  }

  isStoreOpen(): boolean {
    const raw = this.store?.raw as StoreMeta | undefined;
    if (!raw) return true;
    return (raw?.is_open_now ?? raw?.is_open) !== false;
  }

  storeStatusText(): string {
    const raw = this.store?.raw as StoreMeta | undefined;
    if (this.isStoreOpen()) return 'Open now';
    if (raw?.opening_time && raw?.closing_time) {
      return `Closed - Opens ${raw.opening_time}`;
    }
    return 'Closed';
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
    if (img.src.includes(this.placeholderImage)) return;
    img.src = this.placeholderImage;
  }
}
