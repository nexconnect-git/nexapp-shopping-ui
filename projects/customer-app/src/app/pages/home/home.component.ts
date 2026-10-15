import { CustomerIconComponent } from '../../shared/customer-icon/customer-icon.component';
import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../services/catalog.service';
import { AppStateService } from '../../services/app-state.service';
import { UiService } from '../../services/ui.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { StoreCardComponent } from '../../components/store-card/store-card.component';
import { CustomerStateComponent } from '../../shared/customer-state/customer-state.component';
import { categoryIconFor } from '../../shared/category-icons';
@Component({
  standalone: true,
  imports: [CustomerIconComponent,
    RouterLink,
    ProductCardComponent,
    StoreCardComponent,
    CustomerStateComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  readonly categories = computed(() =>
    this.catalog
      .categories()
      .filter((c) => c.id !== 'all')
      .slice(0, 8)
  );
  readonly products = computed(() => (this.catalog.buyAgainProducts().length ? this.catalog.buyAgainProducts() : this.catalog.topProducts()).slice(0, 5));
  readonly buyAgain = computed(() =>
    this.catalog.buyAgainProducts().slice(0, 5)
  );
  readonly stores = computed(() => this.catalog.homeStores().slice(0, 3));
  constructor(
    public catalog: CatalogService,
    public state: AppStateService,
    public ui: UiService
  ) {}
  categoryIcon = categoryIconFor;
}
