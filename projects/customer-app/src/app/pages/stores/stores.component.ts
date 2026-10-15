import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { CustomerIconComponent } from '../../shared/customer-icon/customer-icon.component';
import {
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CatalogService } from '../../services/catalog.service';
import { AppStateService } from '../../services/app-state.service';
import { UiService } from '../../services/ui.service';
import { StoreCardComponent } from '../../components/store-card/store-card.component';
import { CustomerPageHeaderComponent } from '../../shared/customer-page-header/customer-page-header.component';
import { CustomerStateComponent } from '../../shared/customer-state/customer-state.component';
@Component({
  standalone: true,
  imports: [CustomerIconComponent,BreadcrumbsComponent,
    StoreCardComponent,
    CustomerPageHeaderComponent,
    CustomerStateComponent,
  ],
  templateUrl: './stores.component.html',
  styleUrls: ['./stores.component.scss'],
})
export class StoresComponent implements OnDestroy {
  readonly catalog = inject(CatalogService);
  readonly state = inject(AppStateService);
  readonly ui = inject(UiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly category = signal('');
  readonly query = signal('');
  readonly sort = signal('relevance');
  readonly categories = computed(() =>
    this.catalog.categories().filter((c) => c.id !== 'all')
  );
  private readonly subscription: Subscription;
  private timer?: ReturnType<typeof setTimeout>;
  constructor() {
    this.subscription = this.route.queryParamMap.subscribe((p) => {
      this.category.set(p.get('category') || '');
      this.query.set(p.get('q') || '');
      this.sort.set(p.get('sort') || 'relevance');
    });
    effect(() => {
      const params = {
        ...this.state.customerLocationQuery(),
        category: this.category(),
        search: this.query(),
        sort: this.sort(),
      };
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.catalog.loadStores(params), 200);
    });
  }
  setFilter(category: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category: category || null },
      queryParamsHandling: 'merge',
    });
  }
  clearFilters(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {q:null, category:null, sort:null},
      queryParamsHandling: 'merge',
    });
  }
  search(event: Event): void {
    event.preventDefault();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: this.query() || null },
      queryParamsHandling: 'merge',
    });
  }
  setSort(sort: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sort },
      queryParamsHandling: 'merge',
    });
  }
  retry(): void {
    this.catalog.loadStores({
      ...this.state.customerLocationQuery(),
      category: this.category(),
      search: this.query(),
      sort: this.sort(),
    });
  }
  ngOnDestroy(): void {
    clearTimeout(this.timer);
    this.subscription.unsubscribe();
  }
}
