import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'fd-nx-modal-shell',
  standalone: true,
  templateUrl: './nx-modal-shell.component.html',
  styleUrls: ['./nx-modal-shell.component.scss'],
})
export class NxModalShellComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() subtitle = '';
  @Input() width = '720px';
  @Output() closed = new EventEmitter<void>();
}
