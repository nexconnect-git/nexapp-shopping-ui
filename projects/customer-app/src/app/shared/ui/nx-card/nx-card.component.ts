import { Component, Input } from '@angular/core';

@Component({
  selector: 'fd-nx-card',
  standalone: true,
  templateUrl: './nx-card.component.html',
  styleUrls: ['./nx-card.component.scss'],
})
export class NxCardComponent {
  @Input() hover = false;
  @Input() tone: 'default' | 'success' | 'warning' | 'danger' | 'brand' = 'default';
  @Input() padded = true;
}
