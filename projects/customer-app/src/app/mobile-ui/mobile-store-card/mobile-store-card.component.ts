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
}
