import { CommonModule } from '@angular/common';
import { Component, ContentChildren, Directive, EventEmitter, InjectionToken, Input, NgModule, Optional, Output, QueryList, TemplateRef, inject } from '@angular/core';

export interface DynamicTableColumn {
  key: string;
  label: string;
  flex?: string;
  align?: 'left' | 'center' | 'right';
}

export interface DynamicTableDefaults {
  emptyMessage?: string;
  emptySubMessage?: string;
  emptyIcon?: string;
  itemsPerPage?: number;
  hasPagination?: boolean;
}

export const DYNAMIC_TABLE_DEFAULTS = new InjectionToken<DynamicTableDefaults>('DYNAMIC_TABLE_DEFAULTS');

@Directive({
  selector: '[tableCell]',
  standalone: true,
})
export class TableCellDirective {
  @Input('tableCell') columnName!: string;

  constructor(public template: TemplateRef<unknown>) {}
}

@Component({
  selector: 'app-dynamic-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dynamic-table.component.html',
  styleUrl: './dynamic-table.component.scss',
})
export class DynamicTableComponent {
  private defaults = inject(DYNAMIC_TABLE_DEFAULTS, { optional: true });

  @Input() columns: DynamicTableColumn[] = [];
  @Input() data: unknown[] = [];
  @Input() loading = false;
  @Input() emptyMessage = this.defaults?.emptyMessage ?? 'No data found';
  @Input() emptySubMessage = this.defaults?.emptySubMessage ?? 'Try adjusting your filters or create a new record.';
  @Input() emptyIcon = this.defaults?.emptyIcon ?? 'inbox';
  @Input() totalItems = 0;
  @Input() itemsPerPage = this.defaults?.itemsPerPage ?? 20;
  @Input() page = 1;
  @Input() hasPagination = this.defaults?.hasPagination ?? true;
  @Input() clickableRows = false;
  @Input() trackByKey = 'id';

  @Output() pageChange = new EventEmitter<number>();
  @Output() rowClick = new EventEmitter<unknown>();

  @ContentChildren(TableCellDirective) cellTemplates!: QueryList<TableCellDirective>;

  readonly Math = Math;

  getTemplate(columnName: string): TemplateRef<unknown> | null {
    const dir = this.cellTemplates?.find(template => template.columnName === columnName);
    return dir?.template ?? null;
  }

  getGridTemplate(): string {
    return this.columns.map(column => column.flex || '1fr').join(' ');
  }

  getAlignment(column: DynamicTableColumn): string {
    return column.align ? `align-${column.align}` : '';
  }

  getRowId(row: unknown, index: number): unknown {
    if (!row || typeof row !== 'object') return index;
    return (row as Record<string, unknown>)[this.trackByKey] ?? index;
  }

  getValue(row: unknown, key: string): unknown {
    if (!row || typeof row !== 'object') return '';
    return (row as Record<string, unknown>)[key] ?? '';
  }

  onPageChange(newPage: number) {
    const maxPage = Math.ceil(this.totalItems / this.itemsPerPage) || 1;
    if (newPage >= 1 && newPage <= maxPage) {
      this.pageChange.emit(newPage);
    }
  }
}

@NgModule({
  imports: [DynamicTableComponent, TableCellDirective],
  exports: [DynamicTableComponent, TableCellDirective],
})
export class DynamicTableModule {
  static withDefaults(defaults: DynamicTableDefaults) {
    return {
      ngModule: DynamicTableModule,
      providers: [{ provide: DYNAMIC_TABLE_DEFAULTS, useValue: defaults }],
    };
  }
}
