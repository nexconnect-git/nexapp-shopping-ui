import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'fd-nx-input',
  standalone: true,
  templateUrl: './nx-input.component.html',
  styleUrls: ['./nx-input.component.scss'],
})
export class NxInputComponent {
  @Input() label = '';
  @Input() value = '';
  @Input() placeholder = '';
  @Input() icon = '';
  @Input() type = 'text';
  @Input() clearable = false;
  @Input() error = '';
  @Input() hint = '';
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<string>();

  update(value: string): void {
    if (this.disabled) return;
    this.valueChange.emit(value);
  }
}
