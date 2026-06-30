import { Location } from '@angular/common';
import { Component, computed, effect, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AppCurrencyPipe } from '@shared/lib/pipes/currency.pipe';
import { CatalogService } from '../../services/catalog.service';
import { AppStateService } from '../../services/app-state.service';
import { UiService } from '../../services/ui.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';

type DetailPanelId = 'details' | 'nutrition' | 'handling' | 'reviews';

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
  imports: [ProductCardComponent, AppCurrencyPipe],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss'],
})
export class ProductDetailComponent {
  qty = signal(1);
  selectedSize = signal('');
  activePanel = signal<DetailPanelId>('details');
  activeImage = signal(1);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    public catalog: CatalogService,
    public state: AppStateService,
    public ui: UiService,
  ) {
    const productId = this.route.snapshot.paramMap.get('id');
    this.catalog.ensureProductLoaded(productId, this.state.customerLocationQuery());
    effect(() => {
      const storeId = this.product().storeId;
      if (storeId)
        this.catalog.ensureStoreProductsLoaded(
          storeId,
          this.state.customerLocationQuery(),
        );
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
    const vendor = (this.product().raw as any)?.vendor || {};
    if (vendor?.is_serviceable === false) {
      return {
        canOrder: false,
        message:
          vendor?.serviceability_error ||
          'This store is not serviceable for your selected location.',
      };
    }
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
    () => this.stockState().canBuy && this.storeOrderState().canOrder,
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
          item.category === product.category,
      )
      .sort(
        (a, b) =>
          this.recommendationScore(b, product) -
          this.recommendationScore(a, product),
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
          this.isSuggestedProduct(item),
      )
      .sort(
        (a, b) =>
          this.recommendationScore(b, product) -
          this.recommendationScore(a, product),
      )
      .slice(0, 6);
  });
  detailPanels = computed<DetailPanel[]>(() => {
    const product = this.product();
    const raw = (product.raw || {}) as any;
    const template = this.categoryTemplate();
    const panels: DetailPanel[] = [
      {
        id: 'details',
        title: 'Product Details',
        intro:
          raw.description ||
          'Product details update when the store provides them.',
        items: this.compactItems([
          ['Category', product.category],
          ['Detail template', this.categoryTemplateLabel(template)],
          ['Brand', raw.brand],
          ['Unit', product.unit],
          ['Pack size', raw.weight],
          ['Store', product.storeName || 'Partner store'],
          ['SKU', raw.sku],
          ['Barcode', raw.barcode],
        ]),
      },
    ];

    const nutritionItems = this.compactItems([
      ['Ingredients', raw.ingredients],
      ['Allergens', raw.allergens || 'Not specified by vendor'],
      ['Shelf life', raw.shelf_life],
      ['Storage', raw.requires_cold_storage ? 'Keep refrigerated' : 'Standard storage'],
    ]);
    if (this.usesNutritionPanel(template, raw)) {
      panels.push({
        id: 'nutrition',
        title: this.nutritionPanelTitle(template),
        intro:
          raw.ingredients || raw.allergens || raw.shelf_life
            ? 'Vendor-provided product information. Check packaging for complete details.'
            : 'Nutrition details appear when the vendor provides them.',
        items: nutritionItems,
      });
    }

    const handlingItems = this.compactItems([
      ['Packaging', raw.packaging_instructions],
      ['Perishable', raw.is_perishable ? 'Yes' : 'No'],
      ['Cold storage', raw.requires_cold_storage ? 'Required' : 'Not required'],
      ['Fragile', raw.is_fragile ? 'Handle carefully' : 'No'],
      ['Age restricted', raw.is_age_restricted ? 'Yes' : 'No'],
      ['Returnable', raw.is_returnable === false ? 'No' : 'Yes'],
    ]);
    if (handlingItems.length) {
      panels.push({
        id: 'handling',
        title: this.handlingPanelTitle(template),
        intro: 'Handling and care notes configured by the vendor.',
        items: handlingItems,
      });
    }

    panels.push({
      id: 'reviews',
      title: 'Reviews',
      intro: `${product.rating || 'New'} rating. Reviews from verified Nextou orders appear here.`,
      items: this.compactItems([
        ['Average rating', product.rating ? String(product.rating) : 'New'],
        ['Total ratings', String(raw.total_ratings || 0)],
      ]),
    });

    return panels;
  });
  selectedPanel = computed(
    () =>
      this.detailPanels().find((panel) => panel.id === this.activePanel()) ||
      this.detailPanels()[0],
  );

  buyNow(): void {
    if (this.addToCart())
      this.router.navigate(['/checkout']);
  }

  addToCart(): boolean {
    if (!this.canPurchase()) {
      this.state.showToast(
        this.storeOrderState().message || 'This product is not available right now.',
      );
      return false;
    }
    const product = this.product();
    const resolvedId = this.resolveProductId(product);
    if (!resolvedId || resolvedId === 'loading' || resolvedId === 'product') {
      this.state.showToast(
        'This item is still loading. Please try again in a moment.',
      );
      this.catalog.ensureProductLoaded(
        this.route.snapshot.paramMap.get('id'),
        this.state.customerLocationQuery(),
      );
      return false;
    }
    return this.state.addToCart(
      {
        ...product,
        id: resolvedId,
        apiId: resolvedId,
      },
      this.qty(),
    );
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
    this.state.showToast('Image preview opened');
  }

  private resolveProductId(product: any): string {
    return String(
      product?.apiId ||
        product?.id ||
        product?.raw?.id ||
        product?.raw?.product_id ||
        product?.raw?.uuid ||
        product?.raw?.catalog_product_id ||
        '',
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
    const itemEta = this.deliveryEtaMinutes(item?.store?.eta || item?.raw?.vendor?.estimated_delivery_label);
    const baseEta = this.deliveryEtaMinutes(
      this.store()?.eta || (baseProduct?.raw as any)?.vendor?.estimated_delivery_label,
    );
    const rating = Number(item?.rating || item?.raw?.rating || 0);
    const sameUnit = String(item?.unit || '').toLowerCase() === String(baseProduct?.unit || '').toLowerCase();
    const priceGap = Math.abs(Number(item?.price || 0) - Number(baseProduct?.price || 0));
    const etaBoost = Number.isFinite(itemEta) && Number.isFinite(baseEta) ? Math.max(0, 12 - Math.abs(itemEta - baseEta)) : 0;
    return (
      rating * 4 +
      (sameUnit ? 6 : 0) +
      etaBoost -
      Math.min(12, priceGap / 25)
    );
  }

  private deliveryEtaMinutes(value: unknown): number {
    const text = String(value || '').toLowerCase();
    const match = text.match(/(\d+)\s*(min|mins|minute|minutes)/);
    if (!match) return NaN;
    return Number(match[1]);
  }

  private categoryTemplate(): string {
    const product = this.product();
    const key = `${product.category} ${product.name}`.toLowerCase();
    if (key.includes('beverage') || key.includes('drink')) return 'beverage';
    if (key.includes('bakery') || key.includes('food')) return 'food';
    if (key.includes('fruit') || key.includes('vegetable')) return 'grocery';
    if (key.includes('personal') || key.includes('care')) return 'personal_care';
    if (key.includes('home') || key.includes('clean')) return 'home_care';
    if (key.includes('medicine') || key.includes('health')) return 'medicine';
    return 'general';
  }

  private usesNutritionPanel(type: string, raw: any): boolean {
    return (
      ['grocery', 'food', 'beverage', 'personal_care', 'medicine'].includes(
        type,
      ) ||
      Boolean(raw.ingredients || raw.allergens || raw.shelf_life)
    );
  }

  private nutritionPanelTitle(type: string): string {
    if (type === 'personal_care' || type === 'medicine')
      return 'Ingredients & Safety';
    if (type === 'home_care') return 'Composition';
    return 'Nutritional Info';
  }

  private handlingPanelTitle(type: string): string {
    if (type === 'home_care') return 'Use & Care';
    if (type === 'medicine') return 'Safety & Storage';
    return 'Handling & Care';
  }

  private categoryTemplateLabel(type: string): string {
    const labels: Record<string, string> = {
      grocery: 'Grocery / Fresh produce',
      food: 'Prepared food / Bakery',
      beverage: 'Beverage',
      personal_care: 'Personal care',
      home_care: 'Home care',
      medicine: 'Medicine / Health',
      general: 'General merchandise',
    };
    return labels[type] || labels['general'];
  }

  private compactItems(items: Array<[string, unknown]>): DetailItem[] {
    return items
      .map(([label, value]) => ({
        label,
        value: String(value ?? '').trim(),
      }))
      .filter((item) => item.value);
  }

  resolvePanelLabel(panelId: DetailPanelId): string {
    if (panelId === 'details') return 'Product Details';
    if (panelId === 'nutrition') return 'Nutritional Info';
    if (panelId === 'handling') return 'Handling & Care';
    return 'Reviews';
  }
}
