import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'fd-nx-button',
  standalone: true,
  templateUrl: './nx-button.component.html',
  styleUrls: ['./nx-button.component.scss'],
})
export class NxButtonComponent {
  @Input() variant: 'primary' | 'outline' | 'soft' = 'primary';
  @Input() color: 'purple' | 'green' = 'purple';
  @Input() full = false;
  @Input() disabled = false;
  @Input() type: 'button' | 'submit' = 'button';
  @Output() clicked = new EventEmitter<void>();
}
