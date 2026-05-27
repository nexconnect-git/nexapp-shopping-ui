import { Component, computed, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CatalogService } from '../../services/catalog.service';
import { AppStateService } from '../../services/app-state.service';
import { UiService } from '../../services/ui.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'fd-mobile-topbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './mobile-topbar.component.html',
  styleUrls: ['./mobile-topbar.component.scss'],
})
export class MobileTopbarComponent {
  query = signal('');
  suggestions = computed(() =>
    [
      ...this.catalog.products().map((item) => item.name),
      ...this.catalog.categories().map((item) => item.label),
    ]
      .filter(Boolean)
      .slice(0, 5),
  );

  constructor(
    public state: AppStateService,
    public ui: UiService,
    public auth: AuthService,
    private catalog: CatalogService,
    private router: Router,
  ) {}

  search(event: Event): void {
    event.preventDefault();
    const value = this.query().trim();
    this.router.navigate(['/search'], { queryParams: value ? { q: value } : {} });
  }

  openCart(): void {
    this.state.openMiniCart();
    this.ui.openMiniCart();
  }
}
