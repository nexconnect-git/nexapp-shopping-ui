import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, CatalogProposal, Category, ToastService } from '@shared/public-api';

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
  template: `
    <div class="catalog-requests-page fade-in">
      <section class="page-hero">
        <div class="page-hero-copy">
          <span class="eyebrow">Admin catalog</span>
          <h1>Catalog Requests</h1>
          <p>Request missing products so admins can review and add them to the shared catalog.</p>
        </div>
        <div class="page-hero-actions">
          <button type="button" class="btn-primary" (click)="addItem()">
            <span class="material-icons-outlined">add</span>
            Add Item
          </button>
        </div>
      </section>

      <div class="catalog-grid">
        <form class="card request-form" (ngSubmit)="submit()">
          <div class="card-header">
            <div>
              <h3>Propose Items</h3>
              <p>Submit one or more catalog items for admin approval.</p>
            </div>
            <span class="count-pill">{{ draftItems().length }} item{{ draftItems().length === 1 ? '' : 's' }}</span>
          </div>
          <div class="card-body">
            @for (item of draftItems(); track $index) {
              <section class="draft-row">
                <div class="draft-head">
                  <div>
                    <strong>Item {{ $index + 1 }}</strong>
                    <span>{{ item.name || 'New catalog proposal' }}</span>
                  </div>
                  @if (draftItems().length > 1) {
                    <button type="button" class="icon-btn danger" (click)="removeItem($index)" title="Remove item">
                      <span class="material-icons-outlined">delete</span>
                    </button>
                  }
                </div>

                <div class="form-row">
                  <div class="form-group span-2">
                    <label class="form-label">Item Name *</label>
                    <input class="form-input" [(ngModel)]="item.name" name="name_{{$index}}" placeholder="e.g. Amul salted butter 500g" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Category</label>
                    <select class="form-input form-select" [(ngModel)]="item.category_id" name="category_{{$index}}">
                      <option [ngValue]="null">Select category</option>
                      @for (cat of categories(); track cat.id) {
                        <option [ngValue]="cat.id">{{ cat.name }}</option>
                      }
                    </select>
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Brand</label>
                    <input class="form-input" [(ngModel)]="item.brand" name="brand_{{$index}}" placeholder="Brand or maker">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Unit</label>
                    <input class="form-input" [(ngModel)]="item.unit" name="unit_{{$index}}" placeholder="piece, kg, litre">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Barcode</label>
                    <input class="form-input" [(ngModel)]="item.barcode" name="barcode_{{$index}}" placeholder="Optional">
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">SKU Hint</label>
                    <input class="form-input" [(ngModel)]="item.sku_hint" name="sku_{{$index}}" placeholder="Optional internal code">
                  </div>
                  <div class="form-group span-2">
                    <label class="form-label">Description</label>
                    <textarea class="form-input" [(ngModel)]="item.description" name="desc_{{$index}}" rows="2" placeholder="Pack size, flavor, variant, or any catalog detail admins need."></textarea>
                  </div>
                </div>
              </section>
            }

            <div class="form-actions">
              <button type="button" class="btn-outline" (click)="addItem()">
                <span class="material-icons-outlined">add</span>
                Add Another Item
              </button>
              <button type="submit" class="btn-primary" [disabled]="saving()">
                @if (saving()) {
                  <span class="spinner-inline"></span>
                  Submitting...
                } @else {
                  <span class="material-icons-outlined">send</span>
                  Submit Request
                }
              </button>
            </div>
          </div>
        </form>

        <aside class="catalog-help">
          <div class="help-card">
            <span class="material-icons-outlined">tips_and_updates</span>
            <h3>Good requests get approved faster</h3>
            <p>Add clear item names, pack size, brand, unit, barcode, and category when you know it.</p>
          </div>
          <div class="help-stat">
            <strong>{{ proposals().length }}</strong>
            <span>Total requests</span>
          </div>
        </aside>
      </div>

      <div class="card history-card">
        <div class="card-header">
          <div>
            <h3>Request History</h3>
            <p>Track admin review status for your proposed catalog items.</p>
          </div>
        </div>
        <div class="card-body">
          @if (loading()) {
            <div class="loading-state"><div class="spinner"></div><p>Loading requests...</p></div>
          } @else if (proposals().length === 0) {
            <div class="empty-state"><span class="material-icons-outlined">playlist_add</span><p>No catalog requests yet.</p></div>
          } @else {
            <div class="proposal-list">
              @for (proposal of proposals(); track proposal.id) {
                <article class="proposal-card">
                  <div class="proposal-head">
                    <strong>{{ proposal.items.length }} item{{ proposal.items.length !== 1 ? 's' : '' }}</strong>
                    <span class="status-pill" [class]="proposal.status">{{ proposal.status.replace('_', ' ') }}</span>
                  </div>
                  @for (item of proposal.items; track item.id) {
                    <div class="proposal-item">
                      <span>{{ item.name }}</span>
                      <span class="status-pill" [class]="item.status">{{ item.status }}</span>
                      @if (item.rejection_reason) { <small>{{ item.rejection_reason }}</small> }
                    </div>
                  }
                </article>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .catalog-requests-page { display: flex; flex-direction: column; gap: 1.5rem; padding-bottom: 2rem; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
    .eyebrow { margin: 0 0 .25rem; color: var(--primary); font-size: .75rem; font-weight: 900; text-transform: uppercase; letter-spacing: .05em; }
    .page-header h1 { margin: 0; color: var(--text-primary); font-size: 2rem; font-weight: 900; letter-spacing: 0; }
    .page-subtitle { margin: .35rem 0 0; color: var(--text-muted); font-weight: 600; }
    .catalog-grid { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 1rem; align-items: start; }
    .card, .help-card, .help-stat {
      background: white; border: 1px solid var(--border-color);
      border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); overflow: hidden;
    }
    .card-header {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
      padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-light);
    }
    .card-header h3 { margin: 0; color: var(--text-primary); font-size: 1.05rem; font-weight: 900; }
    .card-header p { margin: .25rem 0 0; color: var(--text-muted); font-size: .85rem; font-weight: 600; }
    .card-body { padding: 1.5rem; }
    .count-pill {
      flex-shrink: 0; border-radius: var(--radius-full); background: var(--primary-light);
      color: var(--primary); padding: .35rem .7rem; font-size: .75rem; font-weight: 900;
    }
    .draft-row {
      border: 1px solid var(--border-color); border-radius: var(--radius-lg);
      padding: 1rem; margin-bottom: 1rem; background: #fbfcff;
    }
    .draft-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
    .draft-head strong { display: block; color: var(--text-primary); font-weight: 900; }
    .draft-head span { display: block; color: var(--text-muted); font-size: .82rem; font-weight: 700; margin-top: .15rem; }
    .form-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
    .form-group { margin-bottom: 1rem; }
    .form-group.span-2 { grid-column: span 2; }
    .form-label {
      display: block; margin-bottom: .45rem; color: var(--text-secondary);
      font-size: .75rem; font-weight: 900; text-transform: uppercase; letter-spacing: .04em;
    }
    .form-input {
      width: 100%; min-height: 44px; box-sizing: border-box; border: 1px solid var(--border-color);
      border-radius: var(--radius-md); background: white; color: var(--text-primary);
      padding: .75rem .9rem; font: inherit; font-weight: 700; outline: none;
    }
    textarea.form-input { min-height: 92px; resize: vertical; }
    .form-input:focus { border-color: var(--primary); box-shadow: 0 0 0 4px var(--primary-light); }
    .form-select { appearance: auto; }
    .form-actions { display: flex; align-items: center; justify-content: flex-end; gap: .75rem; padding-top: .25rem; }
    .btn-primary, .btn-outline, .icon-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: .45rem;
      border-radius: var(--radius-md); font-weight: 900; cursor: pointer; text-decoration: none;
      min-height: 42px; padding: .65rem 1rem; transition: all .2s ease; border: 1px solid transparent;
    }
    .btn-primary { background: var(--primary); color: white; box-shadow: 0 4px 12px var(--primary-shadow); }
    .btn-primary:hover:not(:disabled) { background: var(--primary-dark); transform: translateY(-1px); }
    .btn-primary:disabled { opacity: .65; cursor: not-allowed; }
    .btn-outline { background: white; color: var(--text-primary); border-color: var(--border-color); }
    .btn-outline:hover { background: var(--surface-hover); color: var(--primary); }
    .icon-btn { width: 38px; min-height: 38px; padding: 0; background: white; border-color: var(--border-color); color: var(--text-muted); }
    .icon-btn.danger:hover { background: var(--danger-light); border-color: rgba(239,68,68,.25); color: var(--danger); }
    .spinner-inline { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.35); border-top-color: white; border-radius: 50%; animation: spin .8s linear infinite; }
    .catalog-help { display: flex; flex-direction: column; gap: 1rem; position: sticky; top: 1rem; }
    .help-card { padding: 1.25rem; }
    .help-card .material-icons-outlined { color: var(--primary); font-size: 28px; }
    .help-card h3 { margin: .75rem 0 .35rem; color: var(--text-primary); font-size: 1rem; font-weight: 900; }
    .help-card p { margin: 0; color: var(--text-muted); font-weight: 600; line-height: 1.5; }
    .help-stat { padding: 1.25rem; display: flex; align-items: baseline; gap: .6rem; }
    .help-stat strong { color: var(--text-primary); font-size: 2rem; font-weight: 900; }
    .help-stat span { color: var(--text-muted); font-weight: 800; }
    .proposal-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: .85rem; }
    .proposal-card { border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1rem; background: #fbfcff; }
    .proposal-head, .proposal-item { display: flex; gap: .75rem; align-items: center; justify-content: space-between; }
    .proposal-head strong { color: var(--text-primary); font-weight: 900; }
    .proposal-item { border-top: 1px solid var(--border-light); padding-top: .75rem; margin-top: .75rem; flex-wrap: wrap; }
    .proposal-item > span:first-child { color: var(--text-primary); font-weight: 800; }
    .proposal-item small { flex-basis: 100%; color: var(--danger); font-weight: 700; }
    .status-pill { text-transform: capitalize; font-size: .72rem; padding: .25rem .55rem; border-radius: 999px; background: var(--surface-hover); color: var(--text-muted); font-weight: 900; }
    .status-pill.approved { background: var(--success-light); color: var(--success); }
    .status-pill.rejected { background: var(--danger-light); color: var(--danger); }
    .status-pill.pending { background: var(--warning-light); color: var(--warning); }
    .loading-state, .empty-state { min-height: 160px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-muted); font-weight: 800; }
    .empty-state .material-icons-outlined { font-size: 42px; color: #cbd5e1; margin-bottom: .5rem; }
    .spinner { width: 28px; height: 28px; border: 3px solid var(--border-light); border-top-color: var(--primary); border-radius: 50%; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 1100px) {
      .catalog-grid { grid-template-columns: 1fr; }
      .catalog-help { position: static; display: grid; grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 760px) {
      .page-header, .form-actions { flex-direction: column; align-items: stretch; }
      .form-row { grid-template-columns: 1fr; }
      .form-group.span-2 { grid-column: auto; }
      .catalog-help { grid-template-columns: 1fr; }
    }
  `]
})
export class CatalogRequestsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  categories = signal<Category[]>([]);
  proposals = signal<CatalogProposal[]>([]);
  loading = signal(false);
  saving = signal(false);
  draftItems = signal<ProposalDraftItem[]>([this.emptyItem()]);

  ngOnInit() {
    this.api.getVendorCategories().subscribe({ next: (cats) => this.categories.set(cats) });
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
    this.draftItems.update(items => [...items, this.emptyItem()]);
  }

  removeItem(index: number) {
    this.draftItems.update(items => items.filter((_, i) => i !== index));
  }

  submit() {
    const items = this.draftItems()
      .filter(item => item.name.trim())
      .map(item => ({
        name: item.name.trim(),
        category_id: item.category_id,
        description: item.description,
        brand: item.brand,
        unit: item.unit || 'piece',
        barcode: item.barcode,
        sku_hint: item.sku_hint,
      }));
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
        this.toast.show(err.error?.error || 'Failed to submit request.', 'error');
        this.saving.set(false);
      },
    });
  }

  private emptyItem(): ProposalDraftItem {
    return { name: '', category_id: null, description: '', brand: '', unit: 'piece', barcode: '', sku_hint: '' };
  }
}
