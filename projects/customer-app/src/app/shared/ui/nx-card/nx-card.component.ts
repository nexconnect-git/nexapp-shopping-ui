import { Component, Input } from '@angular/core';

@Component({
  selector: 'fd-nx-card',
  standalone: true,
  templateUrl: './nx-card.component.html',
  styleUrls: ['./nx-card.component.scss'],
})
export class NxCardComponent {
  @Input() hover = false;
}
