import { Component, HostListener, input, OnDestroy, output, signal } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
/** Counter surface; PrimeNG owns focus trapping, modal semantics and Escape. */
@Component({ selector: 'nc-vendor-dialog', standalone: true, imports: [DialogModule], templateUrl: './workspace-dialog.component.html', styleUrl: './workspace-dialog.component.scss' })
export class WorkspaceDialogComponent implements OnDestroy {
  readonly phone = signal(window.matchMedia('(max-width:650px)').matches);
  @HostListener('window:resize') resize(): void { this.phone.set(window.matchMedia('(max-width:650px)').matches); }
  readonly title = input.required<string>();
  readonly busy = input(false);
  readonly mode = input<'dialog' | 'drawer'>('dialog');
  readonly restoreFocusTarget = input<HTMLElement | null>(null);
  readonly dismissed = output<void>();
  private readonly previous = document.activeElement as HTMLElement | null;
  onVisibilityChange(visible: boolean): void { if (!visible && !this.busy()) this.dismissed.emit(); }
  ngOnDestroy(): void {
    const target = this.restoreFocusTarget() || this.previous;
    requestAnimationFrame(() => { if (target?.isConnected) target.focus(); });
  }
}
