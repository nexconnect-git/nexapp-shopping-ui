import { CustomerIconComponent } from '../../customer-icon/customer-icon.component';
import { CustomerDialogDirective } from '../../customer-dialog.directive';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'fd-nx-modal-shell',
  standalone: true,
  imports: [CustomerIconComponent,CustomerDialogDirective],
  templateUrl: './nx-modal-shell.component.html',
  styleUrls: ['./nx-modal-shell.component.scss'],
})
export class NxModalShellComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() subtitle = '';
  @Input() width = '490px';
  @Input() variant: 'drawer' | 'center' = 'drawer';
  @Input() eyebrow = '';
  @Input() footer = false;
  @Input() dismissible = true;
  @Output() closed = new EventEmitter<void>();

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  close(): void {
    if (!this.dismissible) return;
    this.closed.emit();
  }
}
