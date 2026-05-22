import { Component } from '@angular/core';
import { UiService } from '../../services/ui.service';

@Component({
  selector: 'fd-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss'],
})
export class ConfirmDialogComponent {
  constructor(public ui: UiService) {}
}
