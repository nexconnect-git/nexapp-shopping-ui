import { Component, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CatalogService } from '../../services/catalog.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { RightRailComponent } from '../../components/right-rail/right-rail.component';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    BreadcrumbsComponent,
    ProductCardComponent,
    RightRailComponent,
  ],
  templateUrl: './category.component.html',
  styleUrls: ['./category.component.scss'],
})
export class CategoryComponent {
  activeFilter = signal('All');
  sortBy = signal('Popularity');

  constructor(
    private route: ActivatedRoute,
    public catalog: CatalogService,
  ) {}

  title = computed(
    () =>
      this.catalog
        .categories()
        .find((c) => c.id === this.route.snapshot.paramMap.get('id'))?.label ??
      'Category',
  );
  allProducts = computed(() => this.catalog.productsByCategory(this.title()));
  categoryFilters = computed(() => {
    const labels = this.allProducts()
      .map((product) => product.category)
      .filter(Boolean);
    return ['All', ...Array.from(new Set(labels)).slice(0, 8)];
  });
  storeCount = computed(
    () =>
      new Set(
        this.visibleProducts()
          .map((product) => product.storeId || product.storeName)
          .filter(Boolean),
      ).size,
  );

  visibleProducts = computed(() => {
    let list = [...this.allProducts()];
    if (this.activeFilter() !== 'All')
      list = list.filter((product) => product.category === this.activeFilter());
    if (this.sortBy() === 'Price Low to High')
      list = [...list].sort((a, b) => a.price - b.price);
    if (this.sortBy() === 'Rating')
      list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  });

  headerIcon(): string {
    return this.filterIcon(this.title());
  }

  filterIcon(filter: string): string {
    const key = filter.toLowerCase();
    if (key === 'all') return 'apps';
    if (key.includes('fruit') || key.includes('veg')) return 'nutrition';
    if (key.includes('milk') || key.includes('dairy')) return 'local_drink';
    if (key.includes('snack')) return 'bakery_dining';
    if (key.includes('home')) return 'home';
    return 'category';
  }
}
