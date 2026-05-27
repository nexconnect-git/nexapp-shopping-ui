import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@shared/public-api';

type Placement =
  | 'home_ad'
  | 'home_engagement'
  | 'offers_shop'
  | 'search_ad'
  | 'store_listing_ad'
  | 'store_detail_ad';
type Template = 'soft_card' | 'club_banner' | 'image_card';
type Tone = 'purple' | 'green' | 'orange' | 'red' | 'blue';

interface CustomerContentBlock {
  id: string;
  placement: Placement;
  placement_label?: string;
  template: Template;
  template_label?: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_url: string;
  icon: string;
  tone: Tone;
  image: string;
  display_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

@Component({
  selector: 'app-customer-content',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-content.component.html',
  styleUrl: './customer-content.component.scss',
})
export class CustomerContentComponent implements OnInit {
  private api = inject(ApiService);

  blocks = signal<CustomerContentBlock[]>([]);
  loading = signal(true);
  saving = signal(false);
  showModal = signal(false);
  editTarget = signal<CustomerContentBlock | null>(null);
  error = signal('');
  activePlacement = signal<Placement | 'all'>('all');

  readonly placements: Array<{ value: Placement | 'all'; label: string }> = [
    { value: 'all', label: 'All placements' },
    { value: 'home_ad', label: 'Home promo cards' },
    { value: 'home_engagement', label: 'Home club banner' },
    { value: 'offers_shop', label: 'Offers page' },
    { value: 'search_ad', label: 'Search page' },
    { value: 'store_listing_ad', label: 'Stores page' },
    { value: 'store_detail_ad', label: 'Store detail' },
  ];
  readonly templateOptions: Array<{ value: Template; label: string }> = [
    { value: 'soft_card', label: 'Soft promo card' },
    { value: 'club_banner', label: 'Club banner' },
    { value: 'image_card', label: 'Image card' },
  ];
  readonly toneOptions: Tone[] = ['purple', 'green', 'orange', 'red', 'blue'];

  form = this.emptyForm();

  ngOnInit() {
    this.load();
  }

  filteredBlocks() {
    const placement = this.activePlacement();
    if (placement === 'all') return this.blocks();
    return this.blocks().filter((block) => block.placement === placement);
  }

  load() {
    this.loading.set(true);
    this.api.getAdminCustomerContentBlocks().subscribe({
      next: (items) => {
        this.blocks.set(items || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate(template: Template = 'soft_card', placement: Placement = 'home_ad') {
    this.editTarget.set(null);
    this.form = this.emptyForm(template, placement);
    this.error.set('');
    this.showModal.set(true);
  }

  openEdit(block: CustomerContentBlock) {
    this.editTarget.set(block);
    this.form = {
      ...block,
      starts_at: this.toDatetimeLocal(block.starts_at),
      ends_at: this.toDatetimeLocal(block.ends_at),
    };
    this.error.set('');
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  save() {
    if (!this.form.title.trim()) {
      this.error.set('Title is required.');
      return;
    }

    const payload = {
      ...this.form,
      starts_at: this.fromDatetimeLocal(this.form.starts_at),
      ends_at: this.fromDatetimeLocal(this.form.ends_at),
    };

    this.saving.set(true);
    this.error.set('');
    const target = this.editTarget();
    const request = target
      ? this.api.updateAdminCustomerContentBlock(target.id, payload)
      : this.api.createAdminCustomerContentBlock(payload);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        this.load();
      },
      error: (err: { error?: Record<string, string[] | string> }) => {
        this.saving.set(false);
        const error = err.error || {};
        this.error.set(
          this.firstError(error['title']) ||
            this.firstError(error['ends_at']) ||
            this.firstError(error['detail']) ||
            'Save failed.',
        );
      },
    });
  }

  toggleActive(block: CustomerContentBlock) {
    this.api
      .updateAdminCustomerContentBlock(block.id, { is_active: !block.is_active })
      .subscribe({ next: () => this.load() });
  }

  duplicate(block: CustomerContentBlock) {
    const copy = {
      ...block,
      id: '',
      title: `${block.title} copy`,
      display_order: block.display_order + 1,
    };
    this.editTarget.set(null);
    this.form = {
      ...copy,
      starts_at: this.toDatetimeLocal(copy.starts_at),
      ends_at: this.toDatetimeLocal(copy.ends_at),
    };
    this.error.set('');
    this.showModal.set(true);
  }

  delete(block: CustomerContentBlock) {
    if (!confirm(`Delete "${block.title}"?`)) return;
    this.api
      .deleteAdminCustomerContentBlock(block.id)
      .subscribe({ next: () => this.load() });
  }

  placementLabel(value: Placement) {
    return (
      this.placements.find((placement) => placement.value === value)?.label ||
      value
    );
  }

  private emptyForm(
    template: Template = 'soft_card',
    placement: Placement = 'home_ad',
  ): CustomerContentBlock {
    return {
      id: '',
      placement,
      template,
      eyebrow: placement === 'home_engagement' ? 'Nextou Club' : 'Today only',
      title:
        placement === 'home_engagement'
          ? 'Save more on repeat orders'
          : 'Top picks for your kitchen',
      subtitle:
        placement === 'home_engagement'
          ? 'Order again, collect offers, and keep everyday essentials close.'
          : 'Curated products from live vendor catalogs.',
      cta_label: placement === 'home_engagement' ? 'Explore rewards' : 'Shop picks',
      cta_url: placement === 'home_engagement' ? '/wallet' : '/search?q=grocery',
      icon: placement === 'home_engagement' ? 'workspace_premium' : 'shopping_basket',
      tone: placement === 'home_engagement' ? 'green' : 'purple',
      image: '',
      display_order: 0,
      is_active: true,
      starts_at: null,
      ends_at: null,
    };
  }

  private toDatetimeLocal(value: string | null): string | null {
    if (!value) return null;
    return value.slice(0, 16);
  }

  private fromDatetimeLocal(value: string | null): string | null {
    return value ? new Date(value).toISOString() : null;
  }

  private firstError(value: string[] | string | undefined): string {
    return Array.isArray(value) ? value[0] || '' : value || '';
  }
}
