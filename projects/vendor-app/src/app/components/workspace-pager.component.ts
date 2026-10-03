import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'nc-vendor-pager',
  standalone: true,
  template: `<nav class="workspace-pager" aria-label="Pagination">
    <span
      >{{ count() }} result{{ count() === 1 ? '' : 's' }} · Page {{ page() }} of
      {{ pages() }}</span
    >
    <div>
      <button
        type="button"
        class="btn btn-secondary"
        [disabled]="busy() || page() <= 1"
        (click)="pageChange.emit(page() - 1)"
      >
        Previous</button
      ><button
        type="button"
        class="btn btn-secondary"
        [disabled]="busy() || page() >= pages()"
        (click)="pageChange.emit(page() + 1)"
      >
        Next
      </button>
    </div>
  </nav>`,
})
export class WorkspacePagerComponent {
  readonly page = input(1);
  readonly count = input(0);
  readonly size = input(20);
  readonly busy = input(false);
  readonly pageChange = output<number>();
  readonly pages = computed(() =>
    Math.max(1, Math.ceil(this.count() / this.size()))
  );
}
