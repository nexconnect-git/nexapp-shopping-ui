import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'fd-mobile-empty-state',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './mobile-empty-state.component.html',
  styleUrls: ['./mobile-empty-state.component.scss'],
})
export class MobileEmptyStateComponent {
  @Input() icon = 'shopping_bag';
  @Input() title = 'Nothing here yet';
  @Input() message = '';
  @Input() actionLabel = '';
  @Input() actionRoute = '/';
}
