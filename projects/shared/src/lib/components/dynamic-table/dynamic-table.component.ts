import { CommonModule } from '@angular/common';
import {
  Component,
  ContentChildren,
  Directive,
  EventEmitter,
  inject,
  InjectionToken,
  Input,
  NgModule,
  Optional,
  Output,
  QueryList,
  TemplateRef,
} from '@angular/core';

export interface DynamicTableColumn {
  key: string;
  label: string;
  flex?: string;
  align?: 'left' | 'center' | 'right';
  minWidth?: number;
}

export interface DynamicTableDefaults {
  emptyMessage?: string;
  emptySubMessage?: string;
  emptyIcon?: string;
  itemsPerPage?: number;
  hasPagination?: boolean;
  contentSizing?: boolean;
}

export const DYNAMIC_TABLE_DEFAULTS = new InjectionToken<DynamicTableDefaults>(
  'DYNAMIC_TABLE_DEFAULTS',
);

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
  @Input() emptySubMessage =
    this.defaults?.emptySubMessage ??
    'Try adjusting your filters or create a new record.';
  @Input() emptyIcon = this.defaults?.emptyIcon ?? 'inbox';
  @Input() totalItems = 0;
  @Input() itemsPerPage = this.defaults?.itemsPerPage ?? 20;
  @Input() page = 1;
  @Input() hasPagination = this.defaults?.hasPagination ?? true;
  @Input() clickableRows = false;
  @Input() trackByKey = 'id';

  @Output() pageChange = new EventEmitter<number>();
  @Output() rowClick = new EventEmitter<unknown>();

  @ContentChildren(TableCellDirective)
  cellTemplates!: QueryList<TableCellDirective>;

  readonly Math = Math;

  getTemplate(columnName: string): TemplateRef<unknown> | null {
    const dir = this.cellTemplates?.find(
      (template) => template.columnName === columnName,
    );
    return dir?.template ?? null;
  }

  getGridTemplate(): string {
    return this.columns.map((column) => {
      const flex = column.flex || '1fr';
      if (!this.defaults?.contentSizing && !column.minWidth) return flex;
      if (!/^\d*\.?\d+fr$/.test(flex)) return flex;
      const width = column.minWidth ?? this.getColumnWidth(column.key);
      return `minmax(${width}px, ${flex})`;
    }).join(' ');
  }

  getMinimumWidth(): string | null {
    if (!this.defaults?.contentSizing && !this.columns.some(column => column.minWidth)) return null;
    const width = this.columns.reduce((sum, column) => {
      const fixedWidth = /^(\d*\.?\d+)px$/.exec(column.flex || '');
      return sum + (fixedWidth ? Number(fixedWidth[1]) : column.minWidth ?? this.getColumnWidth(column.key));
    }, 0);
    return `max(100%, calc(${width + 32}px + ${Math.max(0, this.columns.length - 1)} * 0.85rem))`;
  }

  private getColumnWidth(key: string): number {
    if (/actions|update/.test(key)) return 160;
    if (/email/.test(key)) return 200;
    if (/name|vendor|customer|partner/.test(key)) return 160;
    if (/order_number|reference|phone|date|created/.test(key)) return 140;
    if (/rating/.test(key)) return 110;
    return 100;
  }

  getAlignment(column: DynamicTableColumn): string {
    const alignment = column.align ?? (this.defaults?.contentSizing && /^(total|amount|balance|deliveries|min_order|price|quantity|actions|update)$/.test(column.key) ? 'right' : undefined);
    return alignment ? `align-${alignment}` : '';
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
