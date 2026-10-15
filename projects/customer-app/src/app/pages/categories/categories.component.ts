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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CatalogService } from '../../services/catalog.service';
import { AppStateService } from '../../services/app-state.service';
import { CustomerPageHeaderComponent } from '../../shared/customer-page-header/customer-page-header.component';
import { CustomerStateComponent } from '../../shared/customer-state/customer-state.component';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { categoryMatchesFilterKey } from '@nexconnect/customer-core';
@Component({
  standalone: true,
  imports: [CustomerIconComponent,BreadcrumbsComponent,
    RouterLink,
    CustomerPageHeaderComponent,
    CustomerStateComponent,
    ProductCardComponent,
  ],
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss'],
})
export class CategoriesComponent implements OnDestroy {
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly catalog = inject(CatalogService);
  readonly state = inject(AppStateService);
  readonly selected = signal('all');
  readonly sort = signal('');
  readonly query = signal('');
  readonly availability = signal('all');
  readonly detail = !!this.route.snapshot.paramMap.get('id');
  readonly categories = computed(() =>
    this.catalog.categories().filter((c) => c.id !== 'all')
  );
  readonly category = computed(() =>
    this.catalog.allCategories().find((c) =>
      categoryMatchesFilterKey(c as any, this.selected())
    )
  );
  readonly title = computed(() =>
    this.detail
      ? this.category()?.label || 'Your selected aisle'
      : 'Everyday, in every aisle.'
  );
  readonly children = computed(() =>
    this.catalog.allCategories().filter(
      (c) =>
        String(c.raw?.parent || '') ===
        String(this.category()?.raw?.id || this.category()?.id || '__none')
    )
  );
  private readonly subscriptions = new Subscription();
  constructor() {
    this.subscriptions.add(
      this.route.paramMap.subscribe((p) => {
        if (p.get('id')) this.selected.set(p.get('id')!);
      })
    );
    this.subscriptions.add(
      this.route.queryParamMap.subscribe((p) => {
        if (!this.detail) this.selected.set(p.get('category') || 'all');
        this.sort.set(p.get('ordering') || '');
        this.query.set(p.get('q') || '');
        this.availability.set(p.get('availability') || 'all');
      })
    );
    effect(() => {
      this.refresh(this.selected(), this.sort(), this.query(), this.availability());
    });
  }
  refresh(
    category = this.selected(),
    ordering = this.sort(),
    search = this.query(),
    availability = this.availability()
  ): void {
    this.catalog.loadProducts({
      ...this.state.customerLocationQuery(),
      category: category === 'all' ? '' : category,
      ordering,
      search,
      instant_only: availability === 'instant' ? true : undefined,
    });
  }
  choose(key: string): void {
    this.router.navigate([this.detail && key !== 'all' ? '/category/' + key : '/categories'], {
      queryParams: this.detail ? {} : { category: key === 'all' ? null : key },
      queryParamsHandling: 'merge',
    });
  }
  setAvailability(value: string): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { availability: value === 'all' ? null : value }, queryParamsHandling: 'merge' });
  }
  clearFilters(): void {
    this.router.navigate([this.detail ? '/category/' + this.selected() : '/categories']);
  }
  setSort(value: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ordering: value || null },
      queryParamsHandling: 'merge',
    });
  }
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
