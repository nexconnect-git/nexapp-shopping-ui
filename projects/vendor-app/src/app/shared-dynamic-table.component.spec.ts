import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DynamicTableComponent, TableCellDirective } from '@shared/public-api';

@Component({
  standalone: true,
  imports: [DynamicTableComponent, TableCellDirective],
  template: `
    <app-dynamic-table
      [columns]="columns"
      [data]="rows"
      [loading]="loading"
      [emptyMessage]="emptyMessage"
      [emptySubMessage]="emptySubMessage"
      [emptyIcon]="emptyIcon"
      [totalItems]="totalItems"
      [itemsPerPage]="itemsPerPage"
      [page]="page"
      [clickableRows]="clickableRows"
      trackByKey="id"
      (pageChange)="pageChange($event)"
      (rowClick)="rowClick($event)"
    >
      <ng-template tableCell="status" let-row let-value="value">
        <button class="custom-status" type="button">{{ row.name }}:{{ value }}</button>
      </ng-template>
    </app-dynamic-table>
  `
})
class HostComponent {
  columns = [
    { key: 'name', label: 'Name', minWidth: '120px' },
    { key: 'status', label: 'Status', align: 'center' },
    { key: 'total', label: 'Total', align: 'right' }
  ];
  rows = [
    { id: 'row-1', name: 'Order A', status: 'ready', total: 120 },
    { id: 'row-2', name: 'Order B', status: 'placed', total: 90 }
  ];
  loading = false;
  emptyMessage = 'No records';
  emptySubMessage = 'Try a different filter.';
  emptyIcon = 'receipt_long';
  totalItems = 42;
  itemsPerPage = 20;
  page = 1;
  clickableRows = true;
  pageChange = jasmine.createSpy('pageChange');
  rowClick = jasmine.createSpy('rowClick');
}

describe('DynamicTableComponent integration', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders headers, plain cells, projected cell templates, and pagination metadata', () => {
    expect(fixture.nativeElement.querySelector('.t-header')?.textContent).toContain('Name');
    expect(fixture.nativeElement.querySelector('.t-header')?.textContent).toContain('Total');
    expect(fixture.nativeElement.textContent).toContain('Order A');
    expect(fixture.nativeElement.querySelector('.custom-status')?.textContent).toContain('Order A:ready');
    expect(fixture.nativeElement.querySelector('.page-indicator')?.textContent).toContain('Page 1 of 3');
  });

  it('emits row clicks only when rows are configured as clickable', () => {
    (fixture.nativeElement.querySelector('.t-row') as HTMLElement).click();
    expect(host.rowClick).toHaveBeenCalledWith(host.rows[0]);

    host.rowClick.calls.reset();
    host.clickableRows = false;
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.t-row') as HTMLElement).click();
    expect(host.rowClick).not.toHaveBeenCalled();
  });

  it('emits next page and prevents previous-page underflow', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.page-btn') as NodeListOf<HTMLButtonElement>;

    expect(buttons[0].disabled).toBeTrue();
    buttons[1].click();
    expect(host.pageChange).toHaveBeenCalledWith(2);
  });

  it('disables next on the last page and still supports previous navigation', () => {
    host.page = 3;
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('.page-btn') as NodeListOf<HTMLButtonElement>;

    expect(buttons[1].disabled).toBeTrue();
    buttons[0].click();
    expect(host.pageChange).toHaveBeenCalledWith(2);
  });

  it('renders loading and empty states with configured text', () => {
    host.loading = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-panel')?.textContent).toContain('Loading workspace data');

    host.loading = false;
    host.rows = [];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.empty-state')?.textContent).toContain('No records');
    expect(fixture.nativeElement.querySelector('.empty-state')?.textContent).toContain('Try a different filter.');
  });

  it('exposes useful helper behavior for nested values, alignment, and bounds', () => {
    const table = fixture.debugElement.children[0].componentInstance as DynamicTableComponent;

    expect(table.getValue({ name: 'Nina' }, 'name')).toBe('Nina');
    expect(table.getValue({ customer: null }, 'customer')).toBe('');
    expect(table.getAlignment({ key: 'total', label: 'Total', align: 'right' })).toBe('align-right');
    expect(table.getAlignment({ key: 'status', label: 'Status', align: 'center' })).toBe('align-center');
    table.onPageChange(0);
    table.onPageChange(4);
    expect(host.pageChange).not.toHaveBeenCalledWith(0);
    expect(host.pageChange).not.toHaveBeenCalledWith(4);
  });
});
