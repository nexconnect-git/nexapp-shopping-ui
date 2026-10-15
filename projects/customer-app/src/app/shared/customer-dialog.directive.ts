import { FocusTrap, FocusTrapFactory } from '@angular/cdk/a11y';
import { UiService } from '../services/ui.service';
import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  OnDestroy,
  Output,
} from '@angular/core';

/** One focus/restoration contract for customer dialogs, drawers and sheets. */
@Directive({ selector: '[customerDialog]', standalone: true })
export class CustomerDialogDirective implements AfterViewInit, OnDestroy {
  private readonly overlayHosts = new Set([
    'FD-CONFIRM-DIALOG',
    'FD-LOGIN-SLIDER',
    'FD-MINI-CART',
    'FD-FILTER-SLIDER',
    'FD-LOCATION-MODAL',
    'FD-EDIT-MODAL',
  ]);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly factory = inject(FocusTrapFactory);
  private readonly ui = inject(UiService);
  private trap?: FocusTrap;
  private readonly background: Array<{ element: HTMLElement; inert: boolean }> =
    [];
  private readonly previousOverflow = document.body.style.overflow;
  private readonly ownsScrollLock = this.previousOverflow !== 'hidden';
  private readonly previousFocus =
    document.activeElement instanceof HTMLElement &&
    document.activeElement !== document.body
      ? document.activeElement
      : this.ui.overlayTrigger;
  @Input() dialogBusy = false;
  @Output() dialogDismiss = new EventEmitter<void>();

  ngAfterViewInit(): void {
    const element = this.element.nativeElement;
    document.body.style.overflow = 'hidden';
    // Isolate local route dialogs as well as overlays hosted by the global shell.
    let branch: HTMLElement | null = element;
    while (
      branch?.parentElement &&
      branch.parentElement !== document.documentElement
    ) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (
          sibling !== branch &&
          sibling instanceof HTMLElement &&
          !sibling.classList.contains('cdk-focus-trap-anchor') &&
          // Deferred overlay hosts survive closing. An empty host must remain
          // available to a later nested confirmation, which traps focus itself.
          !(this.overlayHosts.has(sibling.tagName) &&
            !sibling.querySelector('[role="dialog"]')) &&
          !sibling.inert
        ) {
          this.background.push({ element: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
    }
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-modal', 'true');
    element.setAttribute('tabindex', '-1');
    this.trap = this.factory.create(element);
    void this.trap.focusInitialElementWhenReady().then((focused) => {
      if (!focused && element.isConnected) element.focus();
    });
  }

  @HostListener('keydown.escape', ['$event'])
  dismiss(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.dialogBusy) this.dialogDismiss.emit();
  }

  ngOnDestroy(): void {
    this.trap?.destroy();
    for (const entry of this.background) entry.element.inert = entry.inert;
    if (this.ownsScrollLock)
      document.body.style.overflow = this.previousOverflow;
    requestAnimationFrame(() => {
      if (
        this.previousFocus?.isConnected &&
        !this.previousFocus.closest('[inert]')
      )
        this.previousFocus.focus();
    });
  }
}
