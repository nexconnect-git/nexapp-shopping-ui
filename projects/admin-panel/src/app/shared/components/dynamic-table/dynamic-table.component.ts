import { Component, Input, Output, EventEmitter, TemplateRef, ContentChildren, QueryList, Directive } from '@angular/core';
import { CommonModule } from '@angular/common';

@Directive({
  selector: '[tableCell]',
  standalone: true
})
export class TableCellDirective {
  @Input('tableCell') columnName!: string;
  constructor(public template: TemplateRef<any>) {}
}

@Component({
  selector: 'app-dynamic-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dynamic-table.component.html',
  styleUrl: './dynamic-table.component.scss'
})
export class DynamicTableComponent {
  @Input() columns: { key: string, label: string, flex?: string, type?: string }[] = [];
  @Input() data: any[] = [];
  @Input() loading = false;
  
  // Empty State Customization
  @Input() emptyMessage = 'No data found';
  @Input() emptySubMessage = 'Try adjusting your filters or create a new record.';
  @Input() emptyIcon = 'inbox';
  
  // Pagination Customization
  @Input() totalItems = 0;
  @Input() itemsPerPage = 20;
  @Input() page = 1;
  @Input() hasPagination = true;
  @Input() clickableRows = false;

  @Output() pageChange = new EventEmitter<number>();
  @Output() rowClick = new EventEmitter<any>();
  
  Math = Math;

  @ContentChildren(TableCellDirective) cellTemplates!: QueryList<TableCellDirective>;

  getTemplate(columnName: string): TemplateRef<any> | null {
    if (!this.cellTemplates) return null;
    const dir = this.cellTemplates.find(t => t.columnName === columnName);
    return dir ? dir.template : null;
  }

  getGridTemplate(): string {
     return this.columns.map(c => c.flex || '1fr').join(' ');
  }

  onPageChange(newPage: number) {
    if (newPage >= 1 && newPage <= Math.ceil(this.totalItems / this.itemsPerPage)) {
      this.pageChange.emit(newPage);
    }
  }
}
