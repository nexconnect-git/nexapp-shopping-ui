import { CustomerCurrencyPipe } from '../customer-currency/customer-currency.pipe';
import { CustomerIconComponent } from '../customer-icon/customer-icon.component';
import { NxModalShellComponent } from '../ui/nx-modal-shell/nx-modal-shell.component';
import { Component } from '@angular/core';
import { UiService } from '../../services/ui.service';

@Component({
  selector: 'fd-confirm-dialog',
  standalone: true,
  imports: [NxModalShellComponent, CustomerCurrencyPipe, CustomerIconComponent],
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss'],
})
export class ConfirmDialogComponent {
  constructor(public ui: UiService) {}
}
