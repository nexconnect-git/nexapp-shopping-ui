import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'fd-nx-button',
  standalone: true,
  templateUrl: './nx-button.component.html',
  styleUrls: ['./nx-button.component.scss'],
})
export class NxButtonComponent {
  @Input() variant:
    | 'primary'
    | 'secondary'
    | 'outline'
    | 'soft'
    | 'ghost'
    | 'destructive' = 'primary';
  @Input() color: 'purple' | 'green' | 'orange' | 'red' = 'purple';
  @Input() icon = '';
  @Input() loading = false;
  @Input() full = false;
  @Input() disabled = false;
  @Input() type: 'button' | 'submit' = 'button';
  @Output() clicked = new EventEmitter<void>();

  emitClick(): void {
    if (this.disabled || this.loading) return;
    this.clicked.emit();
  }
}
