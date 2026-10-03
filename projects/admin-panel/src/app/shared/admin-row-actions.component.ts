import { CommonModule } from '@angular/common';
import { Component, ContentChild, ElementRef, Input, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { CdkConnectedOverlay, CdkOverlayOrigin, Overlay } from '@angular/cdk/overlay';

@Component({
  selector: 'app-admin-row-actions',
  standalone: true,
  imports: [CommonModule, CdkConnectedOverlay, CdkOverlayOrigin],
  template: `
    <button #trigger cdkOverlayOrigin #origin="cdkOverlayOrigin" type="button" class="row-menu-trigger" [class.text-trigger]="triggerText"
      [attr.aria-label]="label" aria-haspopup="menu" [attr.aria-expanded]="open()"
      (click)="$event.stopPropagation(); open.set(!open())">
      @if (triggerText) { <span>{{triggerText}}</span> }
      <span class="material-icons-outlined" aria-hidden="true">{{triggerText ? 'expand_more' : 'more_horiz'}}</span>
    </button>
    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayHasBackdrop]="true" cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
      [cdkConnectedOverlayScrollStrategy]="scrollStrategy" [cdkConnectedOverlayViewportMargin]="12"
      [cdkConnectedOverlayPush]="true" [cdkConnectedOverlayPositions]="positions"
      (backdropClick)="close()" (detach)="open.set(false)" (attach)="focusFirst()">
      <div #panel class="admin-row-menu" role="menu" tabindex="-1" [attr.aria-label]="label"
        (keydown)="onKey($event)" (click)="$event.stopPropagation(); close(false)">
        <ng-container *ngTemplateOutlet="content" />
      </div>
    </ng-template>
  `,
  styles: [`:host{display:inline-flex}.row-menu-trigger{display:grid;place-items:center;width:36px;height:36px;border:1px solid var(--admin-line);border-radius:7px;background:white;color:var(--admin-muted)}.row-menu-trigger.text-trigger{display:flex;align-items:center;justify-content:center;gap:8px;width:auto;min-height:40px;padding:8px 12px;color:var(--admin-ink);font-size:14px}.row-menu-trigger:hover{background:var(--admin-brand-soft);color:var(--admin-brand)}.material-icons-outlined{font-size:20px}`],
})
export class AdminRowActionsComponent {
  @Input() label = 'More actions';
  @Input() triggerText = '';
  @ContentChild(TemplateRef) content!: TemplateRef<unknown>;
  @ViewChild('trigger') trigger!: ElementRef<HTMLButtonElement>;
  @ViewChild('panel') panel?: ElementRef<HTMLElement>;
  readonly open = signal(false);
  readonly scrollStrategy = inject(Overlay).scrollStrategies.close();
  readonly positions = [
    { originX: 'end' as const, originY: 'bottom' as const, overlayX: 'end' as const, overlayY: 'top' as const, offsetY: 6 },
    { originX: 'end' as const, originY: 'top' as const, overlayX: 'end' as const, overlayY: 'bottom' as const, offsetY: -6 },
  ];
  private items(): HTMLElement[] {
    return Array.from(this.panel?.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []);
  }
  focusFirst() { queueMicrotask(() => (this.items()[0] ?? this.panel?.nativeElement)?.focus()); }
  close(restoreFocus = true) {
    this.open.set(false);
    if (restoreFocus) this.trigger.nativeElement.focus();
  }
  onKey(event: KeyboardEvent) {
    if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); this.close(); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const items = this.items();
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
    items[next]?.focus();
  }
}
