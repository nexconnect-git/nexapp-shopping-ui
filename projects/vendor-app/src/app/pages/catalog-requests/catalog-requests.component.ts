import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  apiErrorMessage,
  VendorApi,
  CatalogProposal,
  Category,
  ToastService,
} from '@shared/public-api';

interface ProposalDraftItem {
  name: string;
  category_id: string | null;
  description: string;
  brand: string;
  unit: string;
  barcode: string;
  sku_hint: string;
}

@Component({
  selector: 'app-catalog-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalog-requests.component.html',
  styleUrl: './catalog-requests.component.scss',
})
export class CatalogRequestsComponent implements OnInit {
  private api = inject(VendorApi);
  private toast = inject(ToastService);

  categories = signal<Category[]>([]);
  proposals = signal<CatalogProposal[]>([]);
  loading = signal(false);
  saving = signal(false);
  draftItems = signal<ProposalDraftItem[]>([this.emptyItem()]);
  draftErrors = signal<Record<string, string>>({});
  readonly unitOptions = [
    { value: 'piece', label: 'Piece' },
    { value: 'pcs', label: 'Pieces' },
    { value: 'pack', label: 'Pack' },
    { value: 'dozen', label: 'Dozen' },
    { value: 'box', label: 'Box' },
    { value: 'bag', label: 'Bag' },
    { value: 'bottle', label: 'Bottle' },
    { value: 'tray', label: 'Tray' },
    { value: 'bunch', label: 'Bunch' },
    { value: 'pair', label: 'Pair' },
    { value: 'kg', label: 'Kilogram (kg)' },
    { value: 'g', label: 'Gram (g)' },
    { value: 'litre', label: 'Litre' },
    { value: 'ml', label: 'Millilitre (ml)' },
  ];

  ngOnInit() {
    this.api
      .getVendorCategories()
      .subscribe({ next: (cats) => this.categories.set(cats) });
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.getVendorCatalogProposals({ page_size: 50 }).subscribe({
      next: (res) => {
        this.proposals.set(res.results || res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  addItem() {
    this.draftItems.update((items) => [...items, this.emptyItem()]);
  }

  removeItem(index: number) {
    this.draftItems.update((items) => items.filter((_, i) => i !== index));
  }

  submit() {
    this.draftErrors.set({});
    const errors: Record<string, string> = {};
    const items = this.draftItems()
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => {
        const hasAnyValue = Object.values(item).some((value) =>
          String(value || '').trim()
        );
        if (hasAnyValue && !item.name.trim()) {
          errors[this.itemErrorKey(index, 'name')] =
            'Item name is required when adding proposal details.';
        }
        return item.name.trim();
      })
      .map((item) => ({
        name: item.item.name.trim(),
        category_id: item.item.category_id,
        description: item.item.description.trim(),
        brand: item.item.brand.trim(),
        unit: item.item.unit.trim().toLowerCase() || 'piece',
        barcode: item.item.barcode.trim().toUpperCase(),
        sku_hint: item.item.sku_hint.trim().toUpperCase(),
      }));
    if (Object.keys(errors).length > 0) {
      this.draftErrors.set(errors);
      this.toast.show('Fix catalog item errors before submitting.', 'error');
      return;
    }
    if (items.length === 0) {
      this.toast.show('Add at least one item name.', 'error');
      return;
    }
    this.saving.set(true);
    this.api.createVendorCatalogProposal({ items }).subscribe({
      next: () => {
        this.toast.show('Catalog request submitted.', 'success');
        this.draftItems.set([this.emptyItem()]);
        this.saving.set(false);
        this.load();
      },
      error: (err) => {
        this.toast.show(apiErrorMessage(err, 'Failed to submit request.'), 'error');
        this.saving.set(false);
      },
    });
  }

  private emptyItem(): ProposalDraftItem {
    return {
      name: '',
      category_id: null,
      description: '',
      brand: '',
      unit: 'piece',
      barcode: '',
      sku_hint: '',
    };
  }

  itemError(index: number, field: string): string {
    return this.draftErrors()[this.itemErrorKey(index, field)] || '';
  }

  clearItemError(index: number, field: string) {
    const key = this.itemErrorKey(index, field);
    if (!this.draftErrors()[key]) return;
    this.draftErrors.update((errors) => {
      const next = { ...errors };
      delete next[key];
      return next;
    });
  }

  canSubmitRequest(): boolean {
    return (
      !this.saving() &&
      Object.keys(this.draftErrors()).length === 0 &&
      this.draftItems().some((item) => item.name.trim())
    );
  }

  private itemErrorKey(index: number, field: string): string {
    return `${index}.${field}`;
  }
}
