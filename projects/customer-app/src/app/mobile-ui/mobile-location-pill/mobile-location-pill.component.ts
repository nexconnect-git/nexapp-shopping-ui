import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'fd-mobile-location-pill',
  standalone: true,
  templateUrl: './mobile-location-pill.component.html',
  styleUrls: ['./mobile-location-pill.component.scss'],
})
export class MobileLocationPillComponent {
  @Input() label = 'Set location';
  @Input() subtitle = 'Delivering to';
  @Output() pressed = new EventEmitter<void>();
}

