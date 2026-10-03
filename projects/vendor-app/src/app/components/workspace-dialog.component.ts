import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  input,
  OnDestroy,
  output,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'nc-vendor-dialog',
  standalone: true,
  template: `<div class="workspace-dialog-backdrop">
    <section
      #panel
      class="workspace-dialog"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="title()"
      tabindex="-1"
    >
      <header>
        <h2>{{ title() }}</h2>
        <button
          type="button"
          class="icon-button"
          aria-label="Close dialog"
          [disabled]="busy()"
          (click)="dismissed.emit()"
        >
          <span class="material-icons-outlined">close</span>
        </button>
      </header>
      <div class="workspace-dialog-body"><ng-content /></div>
    </section>
  </div>`,
})
export class WorkspaceDialogComponent implements AfterViewInit, OnDestroy {
  private static readonly panels = new Set<HTMLElement>();
  private static originalOverflow = '';
  private static returnFocus: HTMLElement | null = null;
  readonly title = input.required<string>();
  readonly busy = input(false);
  readonly restoreFocusTarget = input<HTMLElement | null>(null);
  readonly dismissed = output<void>();
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private previous = document.activeElement as HTMLElement | null;
  ngAfterViewInit(): void {
    if (!WorkspaceDialogComponent.panels.size) {
      WorkspaceDialogComponent.originalOverflow = document.body.style.overflow;
      WorkspaceDialogComponent.returnFocus = this.previous;
    }
    WorkspaceDialogComponent.panels.add(this.panel().nativeElement);
    document.body.style.overflow = 'hidden';
    this.panel().nativeElement.focus();
  }
  ngOnDestroy(): void {
    WorkspaceDialogComponent.panels.delete(this.panel().nativeElement);
    const remaining = [...WorkspaceDialogComponent.panels].at(-1);
    if (remaining) {
      remaining.focus();
      return;
    }
    document.body.style.overflow = WorkspaceDialogComponent.originalOverflow;
    const explicitTarget = this.restoreFocusTarget();
    const target = explicitTarget?.isConnected ? explicitTarget
      : this.previous?.isConnected && this.previous !== document.body
      ? this.previous : WorkspaceDialogComponent.returnFocus;
    target?.focus();
    WorkspaceDialogComponent.returnFocus = null;
  }
  @HostListener('document:keydown', ['$event']) keyboard(
    event: KeyboardEvent
  ): void {
    if (event.key === 'Escape' && !this.busy()) {
      event.preventDefault();
      this.dismissed.emit();
    }
    if (event.key !== 'Tab') return;
    const elements = [
      ...this.panel().nativeElement.querySelectorAll<HTMLElement>(
        'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]'
      ),
    ].filter((element) => element.offsetParent !== null);
    const first = elements[0],
      last = elements.at(-1);
    if (!first) {
      event.preventDefault();
      this.panel().nativeElement.focus();
      return;
    }
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === this.panel().nativeElement)
    ) {
      event.preventDefault();
      last?.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last ||
        document.activeElement === this.panel().nativeElement)
    ) {
      event.preventDefault();
      first.focus();
    }
  }
}
