import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';

import { AlertService } from '../../services/alert.service';

@Component({
  selector: 'app-alert-host',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert-host.component.html',
  styleUrl: './alert-host.component.scss',
})
export class AlertHostComponent {
  readonly alerts = inject(AlertService);
}
