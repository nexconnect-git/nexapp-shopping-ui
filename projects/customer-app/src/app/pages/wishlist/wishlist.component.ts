import { Component, signal } from '@angular/core';
import { ApiService } from '@shared/public-api';
import { Product } from '../../models';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { AppStateService } from '../../services/app-state.service';
import { CatalogService } from '../../services/catalog.service';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';

@Component({
  standalone: true,
  imports: [ProductCardComponent, BreadcrumbsComponent],
  templateUrl: './wishlist.component.html',
  styleUrls: ['./wishlist.component.scss'],
})
export class WishlistComponent {
  items = signal<Product[]>([]);

  constructor(
    private api: ApiService,
    private catalog: CatalogService,
    private state: AppStateService,
  ) {
    this.load();
  }

  load(): void {
    this.api.getWishlist().subscribe({
      next: (response) =>
        this.items.set(
          this.unwrap(response).map((product) =>
            this.catalog.mapProduct(product),
          ),
        ),
      error: () => this.items.set([]),
    });
  }

  remove(id: string): void {
    this.api.toggleWishlist(id).subscribe({
      next: () => {
        this.items.update((list) =>
          list.filter((product) => product.id !== id),
        );
        this.state.showToast('Removed from wishlist');
      },
      error: () => this.state.showToast('Could not update wishlist'),
    });
  }

  private unwrap(response: any): any[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.results)) return response.results;
    if (Array.isArray(response?.products)) return response.products;
    return [];
  }
}
