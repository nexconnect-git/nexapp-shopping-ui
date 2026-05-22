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
}
