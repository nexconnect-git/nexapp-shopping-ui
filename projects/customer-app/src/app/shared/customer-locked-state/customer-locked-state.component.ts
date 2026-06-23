import { Component, inject, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiService } from '../../services/ui.service';

@Component({
  selector: 'fd-customer-locked-state',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './customer-locked-state.component.html',
  styleUrls: ['./customer-locked-state.component.scss'],
})
export class CustomerLockedStateComponent {
  private readonly ui = inject(UiService);

  @Input() title = 'Sign in to continue';
  @Input() description =
    'Log in with your mobile number to view this secure customer page.';
  @Input() icon = 'lock';
  @Input() actionLabel = 'Login';

  openLogin(): void {
    this.ui.openLogin();
  }
}
