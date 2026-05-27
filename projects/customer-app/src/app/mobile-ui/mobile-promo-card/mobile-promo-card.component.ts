import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'fd-mobile-promo-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './mobile-promo-card.component.html',
  styleUrls: ['./mobile-promo-card.component.scss'],
})
export class MobilePromoCardComponent {
  @Input() eyebrow = 'Nextou deal';
  @Input() title = '';
  @Input() subtitle = '';
  @Input() icon = 'local_offer';
  @Input() image = '';
  @Input() cta = '';
  @Input() link = '';
}
