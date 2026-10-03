import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  apiErrorMessage,
  AppCurrencyPipe,
  Product,
  VendorProductPage,
  VendorWorkspaceApi,
} from '@shared/public-api';
import { WorkspaceDialogComponent } from '../../components/workspace-dialog.component';
import { WorkspacePagerComponent } from '../../components/workspace-pager.component';
import { vendorListState } from '../../services/vendor-list-state';
import { VendorContextService } from '../../services/vendor-context.service';
@Component({
  selector: 'app-products',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    AppCurrencyPipe,
    WorkspaceDialogComponent,
    WorkspacePagerComponent,
  ],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss',
})
export class ProductsComponent implements OnInit {
  private readonly api = inject(VendorWorkspaceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly context = inject(VendorContextService);
  readonly list = vendorListState<Product, VendorProductPage>((query) =>
    this.api.products(query)
  );
  readonly search = signal('');
  readonly approval = signal('');
  readonly health = signal('');
  readonly target = signal<Product | null>(null);
  readonly dialog = signal<'delete' | 'fixes' | null>(null);
  readonly pending = signal<ReadonlySet<string>>(new Set());
  readonly errors = signal<ReadonlyMap<string, string>>(new Map());
  readonly approvalOptions = [
    'draft',
    'pending_approval',
    'approved',
    'rejected',
  ];
  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((params) => {
        this.search.set(params.get('search') || '');
        this.approval.set(params.get('approval') || '');
        this.health.set(params.get('health') || '');
        this.list.page.set(Math.max(1, Number(params.get('page')) || 1));
        this.load();
      });
  }
  query(page = 1): void {
    void this.router.navigate([], {
      queryParams: {
        page,
        search: this.search() || null,
        approval: this.approval() || null,
        health: this.health() || null,
      },
    });
  }
  load(): void {
    this.list.load({
      search: this.search(),
      approval_status: this.approval(),
      health: this.health(),
    });
  }
  categoryName(product: Product): string {
    return product.category?.name || 'No category';
  }
  image(product: Product): string {
    return (
      product.primary_image ||
      product.images?.[0]?.image ||
      product.catalog_product?.images?.[0]?.image ||
      '/assets/placeholders/product.svg'
    );
  }
  imageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith('/assets/placeholders/product.svg'))
      image.src = '/assets/placeholders/product.svg';
  }
  open(product: Product, dialog: 'delete' | 'fixes'): void {
    this.setError(product.id, '');
    this.target.set(product);
    this.dialog.set(dialog);
  }
  close(): void {
    if (this.target() && this.pending().has(this.target()!.id)) return;
    this.dialog.set(null);
    this.target.set(null);
  }
  canSubmit(product: Product): boolean {
    return (
      product.approval_status === 'draft' ||
      product.approval_status === 'rejected'
    );
  }
  submit(product: Product): void {
    if (this.pending().has(product.id) || !this.canSubmit(product)) return;
    this.setPending(product.id, true);
    this.setError(product.id, '');
    this.api
      .submitDrafts([product.id], product.approval_note || '')
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (items) => {
          const updated = items.find((item) => item.id === product.id);
          if (!updated) {
            this.setError(
              product.id,
              'Server did not confirm submission. Refresh before retrying.'
            );
          } else {
            this.target.set(updated);
            this.load();
            this.context.refresh();
          }
          this.setPending(product.id, false);
        },
        error: (failure) => {
          this.setPending(product.id, false);
          this.setError(
            product.id,
            apiErrorMessage(
              failure,
              'Product was not submitted. Review its required details.'
            )
          );
        },
      });
  }
  remove(): void {
    const product = this.target();
    if (!product || this.pending().has(product.id)) return;
    this.setPending(product.id, true);
    this.setError(product.id, '');
    this.api
      .deleteProduct(product.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.setPending(product.id, false);
          this.close();
          if (this.list.rows().length === 1 && this.list.page() > 1)
            this.query(this.list.page() - 1);
          else this.load();
          this.context.refresh();
        },
        error: (failure) => {
          this.setPending(product.id, false);
          this.setError(
            product.id,
            apiErrorMessage(failure, 'Product was not removed.')
          );
        },
      });
  }
  private setPending(id: string, value: boolean): void {
    this.pending.update((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  private setError(id: string, message: string): void {
    this.errors.update((current) => new Map(current).set(id, message));
  }
}
