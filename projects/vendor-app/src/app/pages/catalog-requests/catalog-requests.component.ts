import { CounterStateComponent } from '../../components/counter-state.component';
import { CommonModule } from '@angular/common';
import { afterNextRender, Component, DestroyRef, ElementRef, inject, Injector, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  apiErrorMessage,
  CatalogProposal,
  Category,
  VendorWorkspaceApi,
} from '@shared/public-api';
import { vendorListState } from '../../services/vendor-list-state';
import { WorkspacePagerComponent } from '../../components/workspace-pager.component';
import { WorkspaceDialogComponent } from '../../components/workspace-dialog.component';
interface ProposalDraft {
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
  imports: [CounterStateComponent,CommonModule, FormsModule, RouterLink, WorkspacePagerComponent, WorkspaceDialogComponent],
  templateUrl: './catalog-requests.component.html',
  styleUrl: './catalog-requests.component.scss',
})
export class CatalogRequestsComponent implements OnInit {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly injector = inject(Injector);
  private readonly api = inject(VendorWorkspaceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly list = vendorListState<CatalogProposal>((query) =>
    this.api.proposals(query)
  );
  readonly categories = signal<Category[]>([]);
  readonly categoryError = signal('');
  readonly search = signal('');
  readonly status = signal('');
  readonly drafts = signal<ProposalDraft[]>([this.blank()]);
  readonly saving = signal(false);
  readonly editorOpen = signal(false);
  readonly selected = signal<CatalogProposal | null>(null);
  readonly submitError = signal('');
  readonly success = signal('');
  readonly errors = signal<Record<string, string>>({});
  readonly fields: {
    key: 'name' | 'brand' | 'barcode' | 'sku_hint';
    label: string;
    max: number;
  }[] = [
    { key: 'name', label: 'Item name and pack size', max: 200 },
    { key: 'brand', label: 'Brand', max: 120 },
    { key: 'barcode', label: 'Barcode', max: 100 },
    { key: 'sku_hint', label: 'SKU hint', max: 50 },
  ];
  readonly statuses = ['pending', 'partially_approved', 'approved', 'rejected'];
  readonly units = [
    'piece',
    'pcs',
    'pack',
    'dozen',
    'box',
    'bag',
    'bottle',
    'tray',
    'bunch',
    'pair',
    'kg',
    'g',
    'litre',
    'ml',
  ];
  ngOnInit(): void {
    this.loadCategories();
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((params) => {
        this.list.page.set(Math.max(1, Number(params.get('page')) || 1));
        this.search.set(params.get('search') || '');
        this.status.set(params.get('status') || '');
        this.load();
      });
  }
  hasUnsavedChanges(): boolean {
    return this.drafts().some(
      (item) =>
        !!(
          item.name ||
          item.brand ||
          item.description ||
          item.barcode ||
          item.sku_hint ||
          item.category_id
        )
    );
  }
  isSaving(): boolean {
    return this.saving();
  }
  loadCategories(): void {
    this.api
      .categories()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (categories) => {
          this.categories.set(categories);
          this.categoryError.set('');
        },
        error: (failure) =>
          this.categoryError.set(
            apiErrorMessage(failure, 'Categories could not be loaded.')
          ),
      });
  }
  load(): void {
    this.list.load({ search: this.search(), status: this.status() });
  }
  query(page = 1): void {
    void this.router.navigate([], {
      queryParams: {
        page,
        search: this.search() || null,
        status: this.status() || null,
      },
    });
  }
  add(): void {
    if (!this.saving() && this.drafts().length < 50)
      this.drafts.update((items) => [...items, this.blank()]);
  }
  remove(index: number): void {
    if (!this.saving() && this.drafts().length > 1)
      this.drafts.update((items) =>
        items.filter((_, position) => index !== position)
      );
  }
  update(
    index: number,
    field: keyof ProposalDraft,
    value: string | null
  ): void {
    this.drafts.update((items) =>
      items.map((item, position) =>
        position === index ? { ...item, [field]: value } : item
      )
    );
    this.errors.update((errors) => {
      const next = { ...errors };
      if (field === 'name' && value?.trim()) delete next[String(index)];
      return next;
    });
    this.success.set('');
  }
  submit(): void {
    if (this.saving()) return;
    const errors: Record<string, string> = {};
    const submitted = this.drafts().filter(item => !!(item.name.trim() || item.brand.trim() || item.description.trim() || item.barcode.trim() || item.sku_hint.trim() || item.category_id));
    if (!submitted.length) errors['0'] = 'Item name is required.';
    this.drafts().forEach((item, index) => {
      if (submitted.includes(item) && !item.name.trim()) errors[String(index)] = 'Item name is required.';
    });
    this.errors.set(errors);
    if (Object.keys(errors).length) {
      afterNextRender(() => {
        const invalid = this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]');
        invalid?.focus();
        invalid?.scrollIntoView({ block: 'center' });
      }, { injector: this.injector });
      return;
    }
    this.saving.set(true);
    this.submitError.set('');
    this.api
      .createProposal(
        submitted.map((item) => ({ ...item, name: item.name.trim() }))
      )
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (proposal) => {
          this.saving.set(false);
          this.success.set(
            `${proposal.items.length} item${proposal.items.length===1?'':'s'} sent for review.`
          );
          this.drafts.set([this.blank()]);
          this.editorOpen.set(false);
          this.load();
        },
        error: (failure) => {
          this.saving.set(false);
          this.submitError.set(
            apiErrorMessage(
              failure,
              'Request was not submitted. Your item details remain available.'
            )
          );
        },
      });
  }
  private blank(): ProposalDraft {
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
}
