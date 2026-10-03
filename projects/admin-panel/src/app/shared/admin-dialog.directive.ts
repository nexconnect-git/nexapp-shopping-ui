import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostBinding,
  HostListener,
  inject,
  OnDestroy,
  output,
} from '@angular/core';

@Directive({ selector: '[appAdminDialog]', standalone: true })
export class AdminDialogDirective implements AfterViewInit, OnDestroy {
  private static activeDialogs = 0;
  private static previousOverflow = '';
  private element = inject<ElementRef<HTMLElement>>(ElementRef);
  private previous = document.activeElement as HTMLElement | null;
  readonly appAdminDialogClose = output<void>();
  @HostBinding('attr.role') role = 'dialog';
  @HostBinding('attr.aria-modal') modal = 'true';
  @HostBinding('attr.tabindex') tabindex = -1;
  private controls() {
    return [
      ...this.element.nativeElement.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]'
      ),
    ].filter((control) => control.getClientRects().length > 0);
  }
  ngAfterViewInit() {
    if (AdminDialogDirective.activeDialogs++ === 0) {
      AdminDialogDirective.previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    queueMicrotask(() => {
      if (this.element.nativeElement.isConnected)
        (this.controls()[0] || this.element.nativeElement).focus();
    });
  }
  @HostListener('keydown', ['$event']) keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.appAdminDialogClose.emit();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = this.controls();
    const first = controls[0],
      last = controls.at(-1);
    if (!first) {
      event.preventDefault();
      return;
    }
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === this.element.nativeElement)
    ) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  ngOnDestroy() {
    if (--AdminDialogDirective.activeDialogs === 0) {
      document.body.style.overflow = AdminDialogDirective.previousOverflow;
    }
    if (this.previous?.isConnected) this.previous.focus();
  }
}
