import { Component, computed, effect, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, AppCurrencyPipe } from '@shared/public-api';
import { CatalogService } from '../../services/catalog.service';
import { AppStateService } from '../../services/app-state.service';
import { UiService } from '../../services/ui.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';

@Component({
  standalone: true,
  imports: [ProductCardComponent, AppCurrencyPipe],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss'],
})
export class ProductDetailComponent {
  qty = signal(1);
  selectedSize = signal('');
  activePanel = signal<'details' | 'nutrition' | 'reviews'>('details');
  activeImage = signal(1);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    public catalog: CatalogService,
    public state: AppStateService,
    public ui: UiService,
  ) {
    const productId = this.route.snapshot.paramMap.get('id');
    this.catalog.ensureProductLoaded(productId);
    effect(() => {
      const storeId = this.product().storeId;
      if (storeId) this.catalog.ensureStoreProductsLoaded(storeId);
    });
  }
  Math = Math;

  product = computed(() =>
    this.catalog.getProduct(this.route.snapshot.paramMap.get('id')),
  );
  store = computed(() =>
    this.product().storeId
      ? this.catalog.getStore(this.product().storeId)
      : null,
  );
  deliveryLabel = computed(
    () =>
      this.store()?.eta ||
      (this.product().raw as any)?.vendor?.estimated_delivery_label ||
      'Delivery estimate confirmed at checkout',
  );
  deliveryMode = computed(
    () =>
      this.store()?.delivery || 'Delivery availability updates from the store',
  );
  sizes = computed(() => {
    const product = this.product();
    const variants =
      (product.raw as any)?.variants ||
      (product.raw as any)?.available_units ||
      [];
    if (Array.isArray(variants) && variants.length) {
      return variants.map((variant: any) => ({
        label: variant.unit || variant.label || variant.name || product.unit,
        price: Number(variant.price || product.price || 0),
        mrp: Number(
          variant.compare_price ||
            variant.mrp ||
            variant.price ||
            product.mrp ||
            0,
        ),
      }));
    }
    return [{ label: product.unit, price: product.price, mrp: product.mrp }];
  });
  highlights = computed(() =>
    this.product().highlights?.length
      ? this.product().highlights
      : ['Details update when the store provides them'],
  );

  buyNow(): void {
    if (this.state.addToCart(this.product(), this.qty()))
      this.router.navigate(['/checkout']);
  }

  toggleWishlist(): void {
    this.api
      .toggleWishlist(this.product().apiId || this.product().id)
      .subscribe({
        next: (response) =>
          this.state.showToast(
            response.wishlisted ? 'Added to wishlist' : 'Removed from wishlist',
          ),
        error: () => this.state.showToast('Could not update wishlist'),
      });
  }

  zoomImage(): void {
    this.state.showToast('Image preview opened');
  }
}
