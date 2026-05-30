import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../../models';

@Component({
  selector: 'fd-mobile-store-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './mobile-store-card.component.html',
  styleUrls: ['./mobile-store-card.component.scss'],
})
export class MobileStoreCardComponent {
  @Input({ required: true }) store!: Store;
  @Input() compact = false;
  readonly placeholderImage = '/assets/placeholders/store.svg';

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
    if (img.src.includes(this.placeholderImage)) return;
    img.src = this.placeholderImage;
  }
}
