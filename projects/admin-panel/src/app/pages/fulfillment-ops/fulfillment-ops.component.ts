import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, apiErrorMessage } from '@shared/public-api';

interface IssueGroup {
  key: string;
  label: string;
  rows: any[];
}

interface ServiceAreaForm {
  label: string;
  city: string;
  state: string;
  postal_code: string;
  radius_km: string;
}

interface InventoryDraft {
  stock: string;
  low_stock_threshold: string;
  is_available: boolean;
}

interface InventoryCreateForm {
  product_id: string;
  stock: string;
  low_stock_threshold: string;
  is_available: boolean;
}

interface NodeSettingsForm {
  status: string;
  is_accepting_orders: boolean;
  instant_radius_km: string;
  max_delivery_radius_km: string;
  base_prep_time_min: string;
  delivery_time_per_km_min: string;
  daily_order_capacity: string;
}

@Component({
  selector: 'app-fulfillment-ops',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './fulfillment-ops.component.html',
  styleUrl: './fulfillment-ops.component.scss',
})
export class FulfillmentOpsComponent {
  private api = inject(ApiService);

  loading = signal(false);
  error = signal('');
  readiness = signal<any | null>(null);
  stockReport = signal<any | null>(null);
  cartEvents = signal<any | null>(null);
  rolloutResult = signal<any | null>(null);
  reconciliationResult = signal<any | null>(null);
  lastLoaded = signal<Date | null>(null);
  rolloutRunning = signal(false);
  reconciliationRunning = signal(false);
  syncExisting = signal(false);
  fulfillmentNodes = signal<any[]>([]);
  selectedNodeId = signal('');
  nodeSettingsSaving = signal(false);
  nodeSettingsForm = signal<NodeSettingsForm>({
    status: 'active',
    is_accepting_orders: true,
    instant_radius_km: '5',
    max_delivery_radius_km: '10',
    base_prep_time_min: '10',
    delivery_time_per_km_min: '4',
    daily_order_capacity: '0',
  });
  serviceAreas = signal<any[]>([]);
  serviceAreasLoading = signal(false);
  serviceAreaSaving = signal(false);
  serviceAreaActionId = signal('');
  nodeInventory = signal<any[]>([]);
  nodeInventoryLoading = signal(false);
  inventoryActionId = signal('');
  inventoryDrafts = signal<Record<string, InventoryDraft>>({});
  inventoryProductSearch = signal('');
  inventoryProductResults = signal<any[]>([]);
  inventoryProductSearching = signal(false);
  inventoryCreating = signal(false);
  readinessActionId = signal('');
  inventoryCreateForm = signal<InventoryCreateForm>({
    product_id: '',
    stock: '0',
    low_stock_threshold: '5',
    is_available: true,
  });
  serviceAreaForm = signal<ServiceAreaForm>({
    label: '',
    city: '',
    state: '',
    postal_code: '',
    radius_km: '',
  });

  readinessStatus = computed(() => this.readiness()?.status || 'unknown');
  summary = computed(() => this.readiness()?.summary || {});
  stockSummary = computed(() => this.stockReport()?.summary || {});
  cartSummary = computed(() => this.cartEvents()?.summary || {});
  stockRows = computed(() => this.stockReport()?.results || []);
  cartRows = computed(() => this.cartEvents()?.results || []);
  nodeInventoryRows = computed(() => this.nodeInventory());
  selectedNode = computed(() =>
    this.fulfillmentNodes().find((node) => node.id === this.selectedNodeId()) || null,
  );
  issueGroups = computed<IssueGroup[]>(() => {
    const samples = this.readiness()?.samples || {};
    const labels: Record<string, string> = {
      vendors_missing_active_node: 'Stores missing active node',
      sellable_products_missing_node_inventory: 'Products missing node inventory',
      active_nodes_without_sellable_stock: 'Active nodes without sellable stock',
      over_reserved_inventory: 'Over-reserved inventory',
      vendor_node_inventory_mismatches: 'Store-node ownership mismatch',
      visible_inventory_for_unsellable_products: 'Visible inventory for unsellable products',
    };
    return Object.keys(labels)
      .map((key) => ({
        key,
        label: labels[key],
        rows: Array.isArray(samples[key]) ? samples[key] : [],
      }))
      .filter((group) => group.rows.length > 0);
  });

  constructor() {
    this.loadReports();
    this.loadFulfillmentNodes();
  }

  loadReports(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getAdminFulfillmentReadinessReport({ sample_limit: 8 }).subscribe({
      next: (readiness) => {
        this.readiness.set(readiness);
        this.loadSecondaryReports();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  previewRollout(): void {
    this.runRollout(true);
  }

  applyRollout(): void {
    const confirmed = window.confirm(
      'Apply fulfillment backfill now? This creates missing vendor-store nodes and node inventory.',
    );
    if (!confirmed) return;
    this.runRollout(false);
  }

  previewReservationReconciliation(): void {
    this.runReservationReconciliation(true);
  }

  applyReservationReconciliation(): void {
    const confirmed = window.confirm(
      'Apply inventory reservation reconciliation now? This can release stale stock and cancel failed-payment orders.',
    );
    if (!confirmed) return;
    this.runReservationReconciliation(false);
  }

  setSyncExisting(value: boolean): void {
    this.syncExisting.set(value);
  }

  selectNode(nodeId: string): void {
    this.selectedNodeId.set(nodeId);
    const node = this.fulfillmentNodes().find((item) => item.id === nodeId);
    if (node) {
      this.nodeSettingsForm.set(this.nodeSettingsFromNode(node));
    }
    this.serviceAreas.set([]);
    this.nodeInventory.set([]);
    this.inventoryDrafts.set({});
    this.inventoryProductResults.set([]);
    this.inventoryCreateForm.set({
      product_id: '',
      stock: '0',
      low_stock_threshold: '5',
      is_available: true,
    });
    if (nodeId) {
      this.loadServiceAreas(nodeId);
      this.loadNodeInventory(nodeId);
    }
  }

  updateNodeSettingsField(field: keyof NodeSettingsForm, value: string | boolean): void {
    this.nodeSettingsForm.update((form) => ({ ...form, [field]: value }));
  }

  saveNodeSettings(): void {
    const nodeId = this.selectedNodeId();
    const form = this.nodeSettingsForm();
    if (!nodeId) {
      this.error.set('Select a fulfillment node before saving node settings.');
      return;
    }

    const numericFields: Array<keyof NodeSettingsForm> = [
      'instant_radius_km',
      'max_delivery_radius_km',
      'base_prep_time_min',
      'delivery_time_per_km_min',
      'daily_order_capacity',
    ];
    const payload: any = {
      status: form.status,
      is_accepting_orders: form.is_accepting_orders,
    };

    for (const field of numericFields) {
      const value = Number(form[field]);
      if (!Number.isFinite(value) || value < 0) {
        this.error.set('Node capacity and promise fields must be positive numbers.');
        return;
      }
      payload[field] = value;
    }

    this.nodeSettingsSaving.set(true);
    this.error.set('');
    this.api.updateAdminFulfillmentNode(nodeId, payload).subscribe({
      next: (node) => {
        this.nodeSettingsSaving.set(false);
        this.fulfillmentNodes.update((nodes) =>
          nodes.map((item) => (item.id === node.id ? node : item)),
        );
        this.nodeSettingsForm.set(this.nodeSettingsFromNode(node));
        this.loadReports();
      },
      error: (err) => {
        this.nodeSettingsSaving.set(false);
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  updateServiceAreaField(field: keyof ServiceAreaForm, value: string): void {
    this.serviceAreaForm.update((form) => ({ ...form, [field]: value }));
  }

  createServiceArea(): void {
    const nodeId = this.selectedNodeId();
    if (!nodeId) {
      this.error.set('Select a fulfillment node before adding a rollout area.');
      return;
    }

    const form = this.serviceAreaForm();
    const payload: any = {
      label: form.label.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      postal_code: form.postal_code.trim(),
      is_active: true,
      priority: 10,
    };

    if (!payload.label) {
      this.error.set('Rollout area label is required.');
      return;
    }

    if (form.radius_km.trim()) {
      const radius = Number(form.radius_km);
      if (!Number.isFinite(radius) || radius < 0) {
        this.error.set('Radius must be a positive number.');
        return;
      }
      payload.radius_km = radius;
    }

    this.serviceAreaSaving.set(true);
    this.error.set('');
    this.api.createAdminFulfillmentNodeServiceArea(nodeId, payload).subscribe({
      next: () => {
        this.serviceAreaSaving.set(false);
        this.serviceAreaForm.set({
          label: '',
          city: '',
          state: '',
          postal_code: '',
          radius_km: '',
        });
        this.loadServiceAreas(nodeId);
        this.loadReports();
      },
      error: (err) => {
        this.serviceAreaSaving.set(false);
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  setServiceAreaActive(area: any, isActive: boolean): void {
    if (!area?.id) {
      return;
    }

    if (!isActive) {
      const confirmed = window.confirm(
        `Deactivate rollout area "${area.label || area.city || 'selected area'}"?`,
      );
      if (!confirmed) return;
    }

    this.serviceAreaActionId.set(area.id);
    this.error.set('');
    this.api.updateAdminFulfillmentServiceArea(area.id, { is_active: isActive }).subscribe({
      next: () => {
        this.serviceAreaActionId.set('');
        this.reloadSelectedServiceAreas();
        this.loadReports();
      },
      error: (err) => {
        this.serviceAreaActionId.set('');
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  deleteServiceArea(area: any): void {
    if (!area?.id) {
      return;
    }

    const confirmed = window.confirm(
      `Delete rollout area "${area.label || area.city || 'selected area'}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    this.serviceAreaActionId.set(area.id);
    this.error.set('');
    this.api.deleteAdminFulfillmentServiceArea(area.id).subscribe({
      next: () => {
        this.serviceAreaActionId.set('');
        this.reloadSelectedServiceAreas();
        this.loadReports();
      },
      error: (err) => {
        this.serviceAreaActionId.set('');
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  updateInventoryProductSearch(value: string): void {
    this.inventoryProductSearch.set(value);
  }

  searchInventoryProducts(): void {
    const node = this.selectedNode();
    const search = this.inventoryProductSearch().trim();
    if (!this.selectedNodeId()) {
      this.error.set('Select a fulfillment node before searching products.');
      return;
    }
    if (!search) {
      this.error.set('Enter a product name to search.');
      return;
    }

    const params: any = {
      search,
      page_size: 8,
    };
    if (node?.vendor) {
      params.vendor = node.vendor;
    }

    this.inventoryProductSearching.set(true);
    this.error.set('');
    this.api.getAdminProducts(params).subscribe({
      next: (response) => {
        this.inventoryProductResults.set(this.normalizeListResponse(response));
        this.inventoryProductSearching.set(false);
      },
      error: (err) => {
        this.inventoryProductSearching.set(false);
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  selectInventoryProduct(product: any): void {
    if (!product?.id) {
      return;
    }
    this.inventoryCreateForm.update((form) => ({
      ...form,
      product_id: product.id,
    }));
  }

  updateInventoryCreateField(
    field: keyof InventoryCreateForm,
    value: string | boolean,
  ): void {
    this.inventoryCreateForm.update((form) => ({ ...form, [field]: value }));
  }

  createInventory(): void {
    const nodeId = this.selectedNodeId();
    const form = this.inventoryCreateForm();
    if (!nodeId) {
      this.error.set('Select a fulfillment node before adding inventory.');
      return;
    }
    if (!form.product_id) {
      this.error.set('Select a product before adding inventory.');
      return;
    }
    if (this.nodeInventory().some((row) => row.product === form.product_id)) {
      this.error.set('This product is already mapped to the selected node.');
      return;
    }

    const stock = Number(form.stock);
    const lowStockThreshold = Number(form.low_stock_threshold);
    if (!Number.isInteger(stock) || stock < 0) {
      this.error.set('Inventory stock must be a whole number greater than or equal to zero.');
      return;
    }
    if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) {
      this.error.set('Low-stock threshold must be a whole number greater than or equal to zero.');
      return;
    }

    this.inventoryCreating.set(true);
    this.error.set('');
    this.api.createAdminFulfillmentNodeInventory(nodeId, {
      product: form.product_id,
      stock,
      low_stock_threshold: lowStockThreshold,
      is_available: form.is_available,
    }).subscribe({
      next: () => {
        this.inventoryCreating.set(false);
        this.inventoryCreateForm.set({
          product_id: '',
          stock: '0',
          low_stock_threshold: '5',
          is_available: true,
        });
        this.inventoryProductResults.set([]);
        this.inventoryProductSearch.set('');
        this.reloadSelectedInventory();
        this.loadReports();
      },
      error: (err) => {
        this.inventoryCreating.set(false);
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  canQuickFix(groupKey: string, row: any): boolean {
    if (['vendors_missing_active_node', 'sellable_products_missing_node_inventory'].includes(groupKey)) {
      return Boolean(row?.vendor_id);
    }
    return Boolean(row?.node_id);
  }

  quickFixLabel(groupKey: string): string {
    if (['vendors_missing_active_node', 'sellable_products_missing_node_inventory'].includes(groupKey)) {
      return 'Backfill vendor';
    }
    return 'Inspect node';
  }

  runReadinessQuickFix(groupKey: string, row: any): void {
    if (!this.canQuickFix(groupKey, row)) {
      return;
    }

    if (['vendors_missing_active_node', 'sellable_products_missing_node_inventory'].includes(groupKey)) {
      this.backfillVendor(row.vendor_id);
      return;
    }

    this.selectNode(row.node_id);
  }

  private backfillVendor(vendorId: string): void {
    const confirmed = window.confirm(
      'Run fulfillment backfill for this vendor now? This can create missing node and inventory rows.',
    );
    if (!confirmed) return;

    this.readinessActionId.set(vendorId);
    this.error.set('');
    this.api.prepareAdminFulfillmentRollout({
      dry_run: false,
      sync_existing: true,
      vendor_id: vendorId,
      sample_limit: 8,
      confirm: 'BACKFILL_FULFILLMENT',
    }).subscribe({
      next: (result) => {
        this.readinessActionId.set('');
        this.rolloutResult.set(result);
        this.readiness.set(result.readiness || null);
        this.lastLoaded.set(new Date());
        this.loadFulfillmentNodes();
        this.loadSecondaryReports();
      },
      error: (err) => {
        this.readinessActionId.set('');
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  inventoryDraft(id: string): InventoryDraft {
    return this.inventoryDrafts()[id] || {
      stock: '',
      low_stock_threshold: '',
      is_available: false,
    };
  }

  updateInventoryDraftField(
    id: string,
    field: keyof InventoryDraft,
    value: string | boolean,
  ): void {
    this.inventoryDrafts.update((drafts) => ({
      ...drafts,
      [id]: {
        ...this.inventoryDraft(id),
        [field]: value,
      },
    }));
  }

  resetInventoryDraft(row: any): void {
    if (!row?.id) {
      return;
    }
    this.inventoryDrafts.update((drafts) => ({
      ...drafts,
      [row.id]: this.inventoryDraftFromRow(row),
    }));
  }

  saveInventory(row: any): void {
    if (!row?.id) {
      return;
    }

    const draft = this.inventoryDraft(row.id);
    const stock = Number(draft.stock);
    const lowStockThreshold = Number(draft.low_stock_threshold);
    const reservedStock = Number(row.reserved_stock || 0);

    if (!Number.isInteger(stock) || stock < 0) {
      this.error.set('Inventory stock must be a whole number greater than or equal to zero.');
      return;
    }
    if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) {
      this.error.set('Low-stock threshold must be a whole number greater than or equal to zero.');
      return;
    }
    if (stock < reservedStock) {
      this.error.set('Inventory stock cannot be lower than reserved stock.');
      return;
    }

    this.inventoryActionId.set(row.id);
    this.error.set('');
    this.api.updateAdminFulfillmentInventory(row.id, {
      stock,
      low_stock_threshold: lowStockThreshold,
      is_available: draft.is_available,
    }).subscribe({
      next: () => {
        this.inventoryActionId.set('');
        this.reloadSelectedInventory();
        this.loadSecondaryReports();
      },
      error: (err) => {
        this.inventoryActionId.set('');
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  private loadFulfillmentNodes(): void {
    this.api.getAdminFulfillmentNodes({ page_size: 50 }).subscribe({
      next: (response) => {
        const nodes = this.normalizeListResponse(response);
        this.fulfillmentNodes.set(nodes);
        if (!this.selectedNodeId() && nodes.length) {
          this.selectNode(nodes[0].id);
        } else if (this.selectedNodeId()) {
          const selected = nodes.find((node) => node.id === this.selectedNodeId());
          if (selected) {
            this.nodeSettingsForm.set(this.nodeSettingsFromNode(selected));
          }
        }
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  private loadServiceAreas(nodeId: string): void {
    this.serviceAreasLoading.set(true);
    this.api.getAdminFulfillmentNodeServiceAreas(nodeId, { page_size: 50 }).subscribe({
      next: (response) => {
        this.serviceAreas.set(this.normalizeListResponse(response));
        this.serviceAreasLoading.set(false);
      },
      error: (err) => {
        this.serviceAreasLoading.set(false);
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  private loadNodeInventory(nodeId: string): void {
    this.nodeInventoryLoading.set(true);
    this.api.getAdminFulfillmentNodeInventory(nodeId, { page_size: 50 }).subscribe({
      next: (response) => {
        const rows = this.normalizeListResponse(response);
        this.nodeInventory.set(rows);
        this.inventoryDrafts.set(
          rows.reduce((drafts: Record<string, InventoryDraft>, row: any) => {
            drafts[row.id] = this.inventoryDraftFromRow(row);
            return drafts;
          }, {}),
        );
        this.nodeInventoryLoading.set(false);
      },
      error: (err) => {
        this.nodeInventoryLoading.set(false);
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  private reloadSelectedServiceAreas(): void {
    const nodeId = this.selectedNodeId();
    if (nodeId) {
      this.loadServiceAreas(nodeId);
    }
  }

  private reloadSelectedInventory(): void {
    const nodeId = this.selectedNodeId();
    if (nodeId) {
      this.loadNodeInventory(nodeId);
    }
  }

  private inventoryDraftFromRow(row: any): InventoryDraft {
    return {
      stock: String(row?.stock ?? 0),
      low_stock_threshold: String(row?.low_stock_threshold ?? 0),
      is_available: Boolean(row?.is_available),
    };
  }

  private nodeSettingsFromNode(node: any): NodeSettingsForm {
    return {
      status: node?.status || 'active',
      is_accepting_orders: Boolean(node?.is_accepting_orders),
      instant_radius_km: String(node?.instant_radius_km ?? 5),
      max_delivery_radius_km: String(node?.max_delivery_radius_km ?? 10),
      base_prep_time_min: String(node?.base_prep_time_min ?? 10),
      delivery_time_per_km_min: String(node?.delivery_time_per_km_min ?? 4),
      daily_order_capacity: String(node?.daily_order_capacity ?? 0),
    };
  }

  private normalizeListResponse(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }
    if (Array.isArray(response?.results)) {
      return response.results;
    }
    return [];
  }

  private runRollout(dryRun: boolean): void {
    this.rolloutRunning.set(true);
    this.error.set('');
    this.api.prepareAdminFulfillmentRollout({
      dry_run: dryRun,
      sync_existing: this.syncExisting(),
      sample_limit: 8,
      confirm: dryRun ? undefined : 'BACKFILL_FULFILLMENT',
    }).subscribe({
      next: (result) => {
        this.rolloutResult.set(result);
        this.readiness.set(result.readiness || null);
        this.lastLoaded.set(new Date());
        this.rolloutRunning.set(false);
        this.loadSecondaryReports();
      },
      error: (err) => {
        this.rolloutRunning.set(false);
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  private runReservationReconciliation(dryRun: boolean): void {
    this.reconciliationRunning.set(true);
    this.error.set('');
    this.api.reconcileAdminFulfillmentReservations({
      dry_run: dryRun,
      failed_payment_age_minutes: 60,
      confirm: dryRun ? undefined : 'RECONCILE_RESERVATIONS',
    }).subscribe({
      next: (result) => {
        this.reconciliationResult.set(result);
        this.lastLoaded.set(new Date());
        this.reconciliationRunning.set(false);
        this.loadSecondaryReports();
      },
      error: (err) => {
        this.reconciliationRunning.set(false);
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  private loadSecondaryReports(): void {
    this.api.getAdminFulfillmentStockComparison({ mismatches: true }).subscribe({
      next: (stockReport) => {
        this.stockReport.set(stockReport);
        this.loadCartEvents();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  private loadCartEvents(): void {
    this.api.getAdminCartFulfillmentEvents({ limit: 8 }).subscribe({
      next: (cartEvents) => {
        this.cartEvents.set(cartEvents);
        this.lastLoaded.set(new Date());
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  metricValue(key: string): number {
    return Number(this.summary()?.[key] || 0);
  }

  stockMetricValue(key: string): number {
    return Number(this.stockSummary()?.[key] || 0);
  }

  eventCountEntries(): Array<{ name: string; count: number }> {
    const counts = this.cartSummary()?.event_counts || {};
    return Object.keys(counts).map((name) => ({ name, count: Number(counts[name] || 0) }));
  }
}
