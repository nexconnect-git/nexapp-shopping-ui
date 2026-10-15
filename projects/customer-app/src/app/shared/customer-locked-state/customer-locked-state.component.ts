import { CustomerIconComponent } from '../customer-icon/customer-icon.component';
import { Component, inject, Input } from '@angular/core';
import { CustomerStateComponent } from '../customer-state/customer-state.component';
import { BreadcrumbsComponent } from '../breadcrumbs/breadcrumbs.component';
import { RouterLink } from '@angular/router';
import { UiService } from '../../services/ui.service';

@Component({
  selector: 'fd-customer-locked-state',
  standalone: true,
  imports: [RouterLink, CustomerStateComponent, BreadcrumbsComponent, CustomerIconComponent],
  templateUrl: './customer-locked-state.component.html',
  styleUrls: ['./customer-locked-state.component.scss'],
})
export class CustomerLockedStateComponent {
  private readonly ui = inject(UiService);

  @Input() title = 'Sign in to continue';
  @Input() description =
    'Log in with your mobile number to view this secure customer page.';
  @Input() icon = 'lock';
  @Input() artTone: 'default' | 'green' | 'orange' = 'green';
  @Input() actionLabel = 'Sign in or create account';
  @Input() embedded = false;
  @Input() breadcrumb = '';
  @Input() secondaryLabel = 'Keep browsing';
  @Input() secondaryIcon = 'arrow';
  @Input() secondaryLink = '/';

  openLogin(): void {
    this.ui.openLogin();
  }
}
