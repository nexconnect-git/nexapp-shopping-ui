import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { AdminAccessService } from '../services/admin-access.service';

@Directive({ selector: '[appAdminCan]', standalone: true })
export class AdminCanDirective {
  appAdminCan = input.required<string>();
  private template = inject(TemplateRef<unknown>);
  private container = inject(ViewContainerRef);
  private access = inject(AdminAccessService);
  private rendered = false;
  constructor() { effect(() => {
    const allowed = this.access.can(this.appAdminCan());
    if (allowed === this.rendered) return;
    this.rendered = allowed;
    if (allowed) this.container.createEmbeddedView(this.template);
    else this.container.clear();
  }); }
}
