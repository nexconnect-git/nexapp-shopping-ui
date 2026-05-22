import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AppStateService } from '../../services/app-state.service';
import { CustomerContentConfigService } from '../../services/customer-content-config.service';

@Component({
  selector: 'fd-mobile-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './mobile-bottom-nav.component.html',
  styleUrls: ['./mobile-bottom-nav.component.scss'],
})
export class MobileBottomNavComponent {
  constructor(
    public state: AppStateService,
    public content: CustomerContentConfigService,
  ) {}
}
