import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VendorContextService } from '../services/vendor-context.service';
@Component({
  selector: 'nc-vendor-operating-status',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './operating-status.component.html',
  styleUrl: './operating-status.component.scss',
})
export class OperatingStatusComponent {
  readonly store = inject(VendorContextService);
  readonly compact = input(false);
  readonly showAction = input(false);
}
