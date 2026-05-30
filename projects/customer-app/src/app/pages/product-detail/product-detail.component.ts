import { Location } from '@angular/common';
import { Component, computed, effect, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, AppCurrencyPipe } from '@shared/public-api';
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
    if (this.state.addToCart(this.product(), this.qty()))
      this.router.navigate(['/checkout']);
  }

  goBack(): void {
    if (history.length > 1) {
      this.location.back();
      return;
    }
    const storeId = this.store()?.id;
    this.router.navigate(storeId ? ['/store', storeId] : ['/']);
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
}
