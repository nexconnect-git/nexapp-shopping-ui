import { CommonModule } from '@angular/common';
import {
  afterNextRender,
  Component,
  effect,
  ElementRef,
  inject,
  Injector,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ProductEditSaveEvent,
  VendorProductEdit,
} from './vendor-product-edit.models';
import { WorkspaceDialogComponent } from '../../components/workspace-dialog.component';
import { CounterStateComponent } from '../../components/counter-state.component';
import { VendorProductEditService } from './vendor-product-edit.service';
type TextKey =
  | 'productName'
  | 'brand'
  | 'sku'
  | 'quantityPackSize'
  | 'description'
  | 'ingredients'
  | 'complianceNotes'
  | 'allergens'
  | 'shelfLife'
  | 'packagingInstructions';
type NumberKey =
  | 'price'
  | 'stock'
  | 'comparePrice'
  | 'lowStockThreshold'
  | 'minOrderQuantity'
  | 'prepTimeMinutes';
type FlagKey =
  | 'availableForSale'
  | 'instantDelivery'
  | 'scheduledDelivery'
  | 'perishable'
  | 'coldStorage'
  | 'fragile'
  | 'ageRestricted'
  | 'returnable';
@Component({
  selector: 'nc-vendor-product-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, WorkspaceDialogComponent, CounterStateComponent],
  templateUrl: './vendor-product-edit.component.html',
  styleUrl: './vendor-product-edit.component.scss',
})
export class VendorProductEditComponent {
  readonly tab = signal<'selling' | 'details' | 'media' | 'review'>('selling');
  readonly tabs = [
    {key:'selling',label:'Selling'}, {key:'details',label:'Product details'},
    {key:'media',label:'Images & fulfillment'}, {key:'review',label:'Review status'},
  ] as const;
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly injector = inject(Injector);
  readonly removeImage = signal<string | null>(null);
  async confirmImageRemoval(): Promise<void> {
    const id = this.removeImage();
    if (id) {
      await this.service.imageCommand(id, 'delete');
      if (!this.service.error()) this.removeImage.set(null);
    }
  }
  readonly cancelEdit = output<void>();
  readonly saved = output<ProductEditSaveEvent>();
  readonly service = inject(VendorProductEditService);
  readonly advancedOpen = signal(false);
  constructor() {
    effect(() => {
      if (this.optionalHasErrors()) this.advancedOpen.set(true);
    });
  }
  advancedToggled(event: Event): void {
    this.advancedOpen.set((event.target as HTMLDetailsElement).open);
  }
  readonly textFields: { key: TextKey; label: string; multiline?: boolean }[] =
    [
      { key: 'productName', label: 'Product name' },
      { key: 'brand', label: 'Brand' },
      { key: 'sku', label: 'SKU' },
      { key: 'quantityPackSize', label: 'Pack size' },
      { key: 'description', label: 'Description', multiline: true },
      { key: 'ingredients', label: 'Ingredients', multiline: true },
      { key: 'allergens', label: 'Allergens' },
      { key: 'shelfLife', label: 'Shelf life' },
      {
        key: 'packagingInstructions',
        label: 'Packaging instructions',
        multiline: true,
      },
      { key: 'complianceNotes', label: 'Compliance notes', multiline: true },
    ];
  readonly numberFields: {
    key: NumberKey;
    label: string;
    step: string;
    min: number;
  }[] = [
    { key: 'price', label: 'Selling price', step: '0.01', min: 0.01 },
    {
      key: 'comparePrice',
      label: 'Compare price (optional)',
      step: '0.01',
      min: 0,
    },
    { key: 'stock', label: 'Stock units', step: '1', min: 0 },
    {
      key: 'lowStockThreshold',
      label: 'Low stock threshold',
      step: '1',
      min: 0,
    },
    {
      key: 'minOrderQuantity',
      label: 'Minimum order quantity',
      step: '1',
      min: 1,
    },
    { key: 'prepTimeMinutes', label: 'Preparation minutes', step: '1', min: 0 },
  ];
  readonly flags: { key: FlagKey; label: string }[] = [
    { key: 'availableForSale', label: 'Listing enabled' },
    { key: 'instantDelivery', label: 'Instant delivery' },
    { key: 'scheduledDelivery', label: 'Scheduled delivery' },
    { key: 'perishable', label: 'Perishable' },
    { key: 'coldStorage', label: 'Requires cold storage' },
    { key: 'fragile', label: 'Fragile' },
    { key: 'ageRestricted', label: 'Age restricted' },
    { key: 'returnable', label: 'Returnable' },
  ];
  readonly sellingFields = this.numberFields.filter((field) =>
    ['price', 'stock'].includes(field.key)
  );
  readonly optionalNumbers = this.numberFields.filter(
    (field) => !['price', 'stock'].includes(field.key)
  );
  readonly identityFields = this.textFields.filter((field) =>
    ['productName', 'brand', 'quantityPackSize', 'description'].includes(
      field.key
    )
  );
  readonly optionalText = this.textFields.filter(
    (field) =>
      !['productName', 'brand', 'quantityPackSize', 'description'].includes(
        field.key
      )
  );
  readonly deliveryFlags = this.flags.filter(
    (flag) => flag.key !== 'availableForSale'
  );
  optionalHasErrors(): boolean {
    return [
      ...this.optionalNumbers,
      ...this.optionalText,
      ...this.deliveryFlags,
    ].some((field) => !!this.service.fieldError(field.key));
  }
  update<K extends keyof VendorProductEdit>(
    key: K,
    value: VendorProductEdit[K]
  ): void {
    this.service.patch({ [key]: value } as Partial<VendorProductEdit>);
  }
  imageSelected(event: Event): void {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    if (file) void this.service.uploadImage(file);
    input.value = '';
  }
  async save(mode: ProductEditSaveEvent['mode']): Promise<void> {
    try {
      this.saved.emit(await this.service.save(mode));
    } catch {
      const errors = this.service.fieldErrors();
      if (this.sellingFields.some(field => !!errors[field.key]) || errors['status'] || errors['unit']) this.tab.set('selling');
      else if ([...this.textFields, ...this.optionalNumbers].some(field => !!errors[field.key])) this.tab.set('details');
      else if (Object.keys(errors).length) this.tab.set('media');
      if (this.optionalHasErrors()) this.advancedOpen.set(true);
      afterNextRender(
        () => {
          const invalid = this.host.nativeElement.querySelector<HTMLElement>(
            '[aria-invalid="true"]'
          );
          invalid?.focus();
          invalid?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        },
        { injector: this.injector }
      );
    }
  }
}
