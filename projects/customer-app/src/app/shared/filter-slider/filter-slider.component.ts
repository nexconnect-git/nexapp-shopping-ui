import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UiService } from '../../services/ui.service';
import { CatalogService } from '../../services/catalog.service';
import { CustomerIconComponent } from '../customer-icon/customer-icon.component';
import { NxModalShellComponent } from '../ui/nx-modal-shell/nx-modal-shell.component';
@Component({
  selector: 'fd-filter-slider',
  standalone: true,
  imports: [FormsModule, NxModalShellComponent, CustomerIconComponent],
  templateUrl: './filter-slider.component.html',
  styleUrls: ['./filter-slider.component.scss'],
})
export class FilterSliderComponent {
  readonly ui = inject(UiService);
  readonly catalog = inject(CatalogService);
  private router = inject(Router);
  private params = new URLSearchParams(this.router.url.split('?')[1] || '');
  storeMode = false;
  category = this.params.get('category') || '';
  sort = this.params.get('sort') || 'relevance';
  offers = this.params.get('offers') === 'true';
  inStock = this.params.get('in_stock') === 'true';
  maxPrice = this.params.get('max_price') || '';
  rating = this.params.get('rating') === '4.8';
  quick = this.params.get('delivery_time') === '30';
  discount = this.params.get('min_discount') === '15';
  constructor() {
    effect(() => {
      if (!this.ui.filterSliderOpen()) return;
      this.storeMode = this.router.url.split('?')[0] === '/stores';
      this.params = new URLSearchParams(this.router.url.split('?')[1] || '');
      this.category = this.params.get('category') || '';
      this.sort = this.params.get('sort') || 'relevance';
      this.offers = this.params.get('offers') === 'true';
      this.inStock = this.params.get('in_stock') === 'true';
      this.maxPrice = this.params.get('max_price') || '';
      this.rating = this.params.get('rating') === '4.8';
      this.quick = this.params.get('delivery_time') === '30';
      this.discount = this.params.get('min_discount') === '15';
    });
  }
  reset(): void {
    this.category = '';
    this.sort = 'relevance';
    this.offers = false;
    this.inStock = false;
    this.maxPrice = '';
    this.rating = false; this.quick = false; this.discount = false;
  }
  apply(): void {
    this.router.navigate([this.storeMode ? '/stores' : '/explore'], {
      queryParams: {
        q: this.params.get('q') || null,
        category: this.category || null,
        sort: this.sort,
        offers: this.offers || null,
        in_stock: this.inStock || null,
        max_price: this.maxPrice || null,
        rating: this.storeMode ? (this.params.get('rating') || null) : this.rating ? '4.8' : null,
        delivery_time: this.storeMode ? (this.params.get('delivery_time') || null) : this.quick ? '30' : null,
        min_discount: this.storeMode ? null : this.discount ? '15' : null,
        tab: this.params.get('tab') || null,
      },
    });
    this.ui.closeFilter();
  }
}
