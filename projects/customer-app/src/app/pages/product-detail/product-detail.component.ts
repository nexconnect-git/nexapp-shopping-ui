import { CustomerIconComponent } from '../../shared/customer-icon/customer-icon.component';
import { RouterLink } from '@angular/router';
import { CustomerStateComponent } from '../../shared/customer-state/customer-state.component';
import { NxModalShellComponent } from '../../shared/ui/nx-modal-shell/nx-modal-shell.component';
import { Location } from '@angular/common';
import { Component, computed, effect, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CustomerCurrencyPipe as AppCurrencyPipe } from '../../shared/customer-currency/customer-currency.pipe';
import { CatalogService } from '../../services/catalog.service';
import { AppStateService } from '../../services/app-state.service';
import { UiService } from '../../services/ui.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';

type DetailPanelId = 'details' | 'nutrition' | 'reviews';

type DetailItem = {
  label: string;
  value: string;
};

type DetailPanel = {
  id: DetailPanelId;
  title: string;
  intro: string;
  items: DetailItem[];
};

@Component({
  standalone: true,
  imports: [CustomerIconComponent,
    ProductCardComponent,
    AppCurrencyPipe,
    RouterLink,
    CustomerStateComponent,
    NxModalShellComponent,
  ],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss'],
})
export class ProductDetailComponent {
  private readonly routeParams = toSignal(this.route.paramMap);
  readonly imageOpen = signal(false);
  qty = signal(1);
  selectedSize = signal('');
  activeImage = signal(1);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    public catalog: CatalogService,
    public state: AppStateService,
    public ui: UiService
  ) {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => {
      this.qty.set(1);
      this.activeImage.set(1);
      this.imageOpen.set(false);
    });
    effect(() => {
      this.catalog.ensureProductLoaded(
        this.routeParams()?.get('id') || null,
        this.state.customerLocationQuery(),
        true
      );
    });
    effect(() => {
      const storeId = this.product().storeId;
      if (storeId)
        this.catalog.ensureStoreProductsLoaded(
          storeId,
          this.state.customerLocationQuery()
        );
    });
  }
  Math = Math;

  product = computed(() =>
    this.catalog.getProduct(this.routeParams()?.get('id') || null)
  );
  store = computed(() =>
    this.product().storeId
      ? this.catalog.getStore(this.product().storeId)
      : null
  );
  deliveryLabel = computed(
    () =>
      this.store()?.eta ||
      (this.product().raw as any)?.vendor?.estimated_delivery_label ||
      'Delivery estimate confirmed at checkout'
  );
  deliveryMode = computed(
    () =>
      this.store()?.delivery || 'Delivery availability updates from the store'
  );
  deliveryPromise = computed(() => {
    const raw = (this.product().raw as any) || {};
    if (raw?.is_instant_delivery) return 'Instant delivery eligible';
    if (raw?.is_scheduled_delivery) return 'Scheduled delivery supported';
    const storeEta = this.store()?.eta;
    return storeEta
      ? `Expected in ${storeEta}`
      : 'Delivery estimate confirmed at checkout';
  });
  stockState = computed(() => {
    const raw = (this.product().raw as any) || {};
    const stock = Number(raw?.stock ?? 0);
    const lowThreshold = Number(raw?.low_stock_threshold ?? 5);
    const available = raw?.is_available !== false && raw?.in_stock !== false;
    if (!available || (Number.isFinite(stock) && stock <= 0)) {
      return { canBuy: false, label: 'Out of stock', tone: 'danger' as const };
    }
    if (Number.isFinite(stock) && stock > 0 && stock <= lowThreshold) {
      return {
        canBuy: true,
        label: `Only ${stock} left`,
        tone: 'warning' as const,
      };
    }
    return { canBuy: true, label: 'In stock', tone: 'success' as const };
  });
  storeOrderState = computed(() => {
    const serviceability = this.state.serviceability();
    if (this.state.deliveryUnavailable()) {
      return {
        canOrder: false,
        message:
          serviceability?.message ||
          'Delivery is not available for your selected location. Choose another address to continue.',
      };
    }
    const vendor = (this.product().raw as any)?.vendor || {};
    if (vendor?.is_serviceable === false) {
      return {
        canOrder: false,
        message:
          vendor?.serviceability_error ||
          'This store is not serviceable for your selected location.',
      };
    }
    if (vendor?.is_open !== false && vendor?.is_accepting_orders === false) return { canOrder:false, message:'This store is temporarily not accepting orders.' };
    if ((vendor?.is_open_now ?? vendor?.is_open) === false) {
      return { canOrder: false, message: 'This store is currently closed.' };
    }
    if (vendor?.is_accepting_orders === false) {
      return {
        canOrder: false,
        message: 'This store is temporarily not accepting orders.',
      };
    }
    return { canOrder: true, message: '' };
  });
  canPurchase = computed(
    () => this.stockState().canBuy && this.storeOrderState().canOrder && !this.catalog.productErrors()[this.detailId] && !this.catalog.productDetailLoading()[this.detailId]
  );
  sizes = computed(() => [
    {
      label: this.product().unit,
      price: this.product().price,
      mrp: this.product().mrp,
    },
  ]);
  readonly gallery = computed(() => {
    const raw = this.product().raw as any;
    const urls = [
      this.product().image,
      ...(Array.isArray(raw?.images)
        ? raw.images.map((image: any) => image.image || image.url)
        : []),
    ].filter(Boolean);
    return [...new Set<string>(urls)];
  });
  get detailId(): string {
    return this.routeParams()?.get('id') || '';
  }
  retry(): void {
    this.catalog.ensureProductLoaded(
      this.detailId,
      this.state.customerLocationQuery(),
      true
    );
  }
  increase(): void {
    const stock = Number(this.product().raw?.stock);
    if (!Number.isFinite(stock) || this.qty() < stock)
      this.qty.update((q) => q + 1);
  }
  highlights = computed<string[]>(() => {
    const highlights = this.product().highlights ?? [];
    return highlights.length
      ? highlights
      : ['Details update when the store provides them'];
  });
  shortHighlights = computed(() => this.highlights().slice(0, 2));
  similarFromStore = computed(() => {
    const product = this.product();
    if (!product.storeId) return [];
    return this.catalog
      .productsByStore(product.storeId)
      .filter(
        (item) =>
          item.id !== product.id &&
          this.isSuggestedProduct(item) &&
          item.category === product.category
      )
      .sort(
        (a, b) =>
          this.recommendationScore(b, product) -
          this.recommendationScore(a, product)
      )
      .slice(0, 6);
  });
  similarFromCategory = computed(() => {
    const product = this.product();
    return this.catalog
      .productsByCategory(product.category)
      .filter(
        (item) =>
          item.id !== product.id &&
          item.storeId !== product.storeId &&
          this.isSuggestedProduct(item)
      )
      .sort(
        (a, b) =>
          this.recommendationScore(b, product) -
          this.recommendationScore(a, product)
      )
      .slice(0, 6);
  });
  detailPanels = computed<DetailPanel[]>(() => {
    const product = this.product();
    const raw = (product.raw || {}) as any;
    const panels: DetailPanel[] = [
      {
        id: 'details',
        title: 'Product Details',
        intro:
          raw.description ||
          'Product details update when the store provides them.',
        items: this.compactItems([
          ['Category', product.category],
          ['Brand', raw.brand],
          ['Unit', product.unit],
          ['Pack size', raw.weight],
          ['Store', product.storeName || 'Partner store'],
          ['SKU', raw.sku],
          ['Barcode', raw.barcode],
        ]),
      },
    ];

    const informationItems = this.compactItems([
      ['Pack', product.unit],
      ['Ingredients', raw.ingredients],
      ['Allergens', raw.allergens],
      ['Shelf life', raw.shelf_life],
      ['Packaging', raw.packaging_instructions],
      ['Perishable', raw.is_perishable == null ? '' : raw.is_perishable ? 'Yes' : 'No'],
      ['Storage', raw.requires_cold_storage == null ? '' : raw.requires_cold_storage ? 'Keep refrigerated' : 'Cold storage not required'],
      ['Fragile', raw.is_fragile == null ? '' : raw.is_fragile ? 'Handle carefully' : 'No'],
      ['Age restricted', raw.is_age_restricted == null ? '' : raw.is_age_restricted ? 'Yes' : 'No'],
      ['Returnable', raw.is_returnable == null ? '' : raw.is_returnable ? 'Yes' : 'No'],
    ]);
    if (informationItems.length) {
      panels.push({
        id: 'nutrition',
        title: 'Ingredients, storage & other details',
        intro: 'Vendor-provided product information. Check packaging for complete details.',
        items: informationItems,
      });
    }

    panels.push({
      id: 'reviews',
      title: 'Reviews',
      intro: `${
        product.rating || 'New'
      } rating. Reviews from verified Nextou orders appear here.`,
      items: this.compactItems([
        ['Average rating', product.rating ? String(product.rating) : 'New'],
        ['Total ratings', String(raw.total_ratings || 0)],
      ]),
    });

    return panels;
  });
  buyNow(): void {
    this.addToCart(true);
  }
  addToCart(checkout = false): boolean {
    if (!this.canPurchase()) return false;
    return this.state.addToCart(this.product(), this.qty(), (success) => {
      if (success && checkout) {
        this.state.closeMiniCart();
        this.router.navigate(['/checkout']);
      }
    });
  }
  goBack(): void {
    if (history.length > 1) {
      this.location.back();
      return;
    }
    const storeId = this.store()?.id;
    this.router.navigate(storeId ? ['/store', storeId] : ['/']);
  }

  zoomImage(): void {
    this.imageOpen.set(true);
  }

  private resolveProductId(product: any): string {
    return String(
      product?.apiId ||
        product?.id ||
        product?.raw?.id ||
        product?.raw?.product_id ||
        product?.raw?.uuid ||
        product?.raw?.catalog_product_id ||
        ''
    ).trim();
  }

  private isSuggestedProduct(item: any): boolean {
    const raw = item?.raw || item || {};
    if (raw.is_available === false || raw.in_stock === false) return false;
    if (raw.status && raw.status !== 'active') return false;
    if (raw.approval_status && raw.approval_status !== 'approved') return false;
    const stock = Number(raw.stock);
    return !Number.isFinite(stock) || stock > 0;
  }

  private recommendationScore(item: any, baseProduct: any): number {
    const itemEta = this.deliveryEtaMinutes(
      item?.store?.eta || item?.raw?.vendor?.estimated_delivery_label
    );
    const baseEta = this.deliveryEtaMinutes(
      this.store()?.eta ||
        (baseProduct?.raw as any)?.vendor?.estimated_delivery_label
    );
    const rating = Number(item?.rating || item?.raw?.rating || 0);
    const sameUnit =
      String(item?.unit || '').toLowerCase() ===
      String(baseProduct?.unit || '').toLowerCase();
    const priceGap = Math.abs(
      Number(item?.price || 0) - Number(baseProduct?.price || 0)
    );
    const etaBoost =
      Number.isFinite(itemEta) && Number.isFinite(baseEta)
        ? Math.max(0, 12 - Math.abs(itemEta - baseEta))
        : 0;
    return (
      rating * 4 + (sameUnit ? 6 : 0) + etaBoost - Math.min(12, priceGap / 25)
    );
  }

  private deliveryEtaMinutes(value: unknown): number {
    const text = String(value || '').toLowerCase();
    const match = text.match(/(\d+)\s*(min|mins|minute|minutes)/);
    if (!match) return NaN;
    return Number(match[1]);
  }

  private compactItems(items: Array<[string, unknown]>): DetailItem[] {
    return items
      .map(([label, value]) => ({
        label,
        value: String(value ?? '').trim(),
      }))
      .filter((item) => item.value);
  }

}
