import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppCurrencyPipe } from '@shared/lib/pipes/currency.pipe';
import { categoryFilterKey } from '@nexconnect/customer-core';
import { buildProductFilterQuery } from '@nexconnect/customer-search';
import { buildCustomerLocationQuery } from '@nexconnect/customer-location';
import { UiService } from '../../services/ui.service';
import { AppStateService } from '../../services/app-state.service';
import { CatalogService } from '../../services/catalog.service';
import { NxButtonComponent } from '../ui/nx-button/nx-button.component';
import { CustomerContentConfigService } from '../../services/customer-content-config.service';

@Component({
  selector: 'fd-filter-slider',
  standalone: true,
  imports: [NxButtonComponent, AppCurrencyPipe],
  templateUrl: './filter-slider.component.html',
  styleUrls: ['./filter-slider.component.scss'],
})
export class FilterSliderComponent {
  delivery = computed(() => [
    'Any',
    ...Array.from(
      new Set(
        this.catalog
          .stores()
          .map((store) => store.delivery)
          .filter(Boolean),
      ),
    ).slice(0, 6),
  ]);
  sort = computed(() => this.content.filters().sortOptions);
  offers = computed(() => [
    'All',
    ...this.catalog
      .topCoupons()
      .map((coupon) => coupon.code)
      .filter(Boolean)
      .slice(0, 8),
  ]);
  categories = computed(() => [
    'All',
    ...this.catalog
      .categories()
      .filter((category) => category.id !== 'all')
      .map((category) => category.label)
      .slice(0, 10),
  ]);
  selectedDelivery = signal('Any');
  selectedSort = signal('Relevance');
  selectedOffer = signal('All');
  selectedCategory = signal('All');
  price = signal(1000);

  constructor(
    public ui: UiService,
    private state: AppStateService,
    private catalog: CatalogService,
    private router: Router,
    public content: CustomerContentConfigService,
  ) {}

  reset(): void {
    this.selectedDelivery.set('Any');
    this.selectedSort.set(this.sort()[0] || 'Relevance');
    this.selectedOffer.set('All');
    this.selectedCategory.set('All');
    this.price.set(1000);
  }

  apply(): void {
    const address = this.state.activeAddress();
    const selectedCategory = this.selectedCategory();
    const category = this.catalog
      .categories()
      .find((item) => item.label === selectedCategory);
    const sort =
      this.selectedSort() === 'Rating'
        ? 'rating'
        : this.selectedSort() === 'Delivery Time'
          ? 'distance'
          : this.selectedSort() === 'Price Low to High'
            ? 'min_order_asc'
            : 'relevance';
    const params = buildProductFilterQuery(
      {
        category:
          selectedCategory === 'All'
            ? ''
            : category
              ? categoryFilterKey(category as any)
              : selectedCategory,
        maxPrice: this.price(),
        offersOnly: this.selectedOffer() !== 'All',
        sort,
      },
      buildCustomerLocationQuery({
        lat: address?.latitude,
        lng: address?.longitude,
        state: address?.state,
        city: address?.city,
      }),
    );
    this.catalog.loadStores(params);
    this.router.navigate(['/stores'], {
      queryParams:
        selectedCategory === 'All' ? {} : { category: params['category'] },
    });
    this.state.showToast('Filters applied');
    this.ui.closeFilter();
  }
}
