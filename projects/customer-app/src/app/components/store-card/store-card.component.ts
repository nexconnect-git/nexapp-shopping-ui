import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../../models';

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

  isStoreOpen(): boolean {
    const raw = this.store?.raw as any;
    if (!raw) return true;
    return (raw?.is_open_now ?? raw?.is_open) !== false;
  }

  storeStatusText(): string {
    const raw = this.store?.raw as any;
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
