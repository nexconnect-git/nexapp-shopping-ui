import { CustomerOrderApiService } from '../../services/customer-order-api.service';
import { CustomerIconComponent } from '../../shared/customer-icon/customer-icon.component';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Component,
  computed,
  HostListener,
  effect,
  inject,
  OnDestroy,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, timeout } from 'rxjs';
import { ApiService } from '@shared/lib/services/api.service';
import { AuthService } from '../../services/auth.service';
import { AuthService as SharedAuthService } from '@shared/lib/services/auth.service';
import { OrderService } from '../../services/order.service';
import { UiService } from '../../services/ui.service';
import { CustomerPageHeaderComponent } from '../../shared/customer-page-header/customer-page-header.component';
import { CustomerStateComponent } from '../../shared/customer-state/customer-state.component';
import { CustomerLockedStateComponent } from '../../shared/customer-locked-state/customer-locked-state.component';
@Component({
  standalone: true,
  imports: [
    FormsModule,
    CustomerIconComponent,
    BreadcrumbsComponent,
    RouterLink,
    CustomerPageHeaderComponent,
    CustomerStateComponent,
    CustomerLockedStateComponent,
  ],
  templateUrl: './support.component.html',
  styleUrls: ['./support.component.scss'],
})
export class SupportComponent implements OnDestroy {
  readonly api = inject(ApiService);
  private readonly orderApi=inject(CustomerOrderApiService);
  readonly orderContext=signal<any>(null);
  readonly submittedIssue=signal<any>(null);
  readonly recentOrder=computed(()=>this.orders.orders()[0]?.raw || null);
  readonly auth = inject(AuthService);
  readonly orders = inject(OrderService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ui = inject(UiService);
  private sharedAuth = inject(SharedAuthService);
  private customerId = this.sharedAuth.user()?.id || '';
  private requests = new Subscription();
  private version = 0;
  readonly mode = this.route.snapshot.data['mode'] || 'help';
  orderId = '';
  issueId = '';
  loading = signal(false);
  error = signal('');
  pending = signal(false);
  issues = signal<any[]>([]);
  issue = signal<any>(null);
  options = signal<any[]>([]);
  issueType = signal('');
  description = signal('');
  message = signal('');
  fieldErrors = signal<Record<string, string>>({});
  fileError = signal('');
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.orderId = params.get('id') || '';
      this.issueId = params.get('issueId') || '';
      this.resetPrivateState();
      this.load();
      const suggested=this.route.snapshot.queryParamMap.get('type')||'';
      if(suggested)this.issueType.set(suggested);
    });
    effect(() => {
      const customerId = this.sharedAuth.user()?.id || '';
      if (customerId === this.customerId) return;
      untracked(() => {
        this.customerId = customerId;
        this.resetPrivateState();
        this.load();
      });
    });
  }
  private resetPrivateState(): void {
    this.version++;
    this.orderContext.set(null);this.submittedIssue.set(null);
    this.requests.unsubscribe();
    this.requests = new Subscription();
    this.loading.set(false);
    this.pending.set(false);
    this.issues.set([]);
    this.issue.set(null);
    this.options.set([]);
    this.issueType.set('');
    this.description.set('');
    this.message.set('');
    this.fieldErrors.set({});
    this.fileError.set('');
    this.error.set('');
  }
  load(): void {
    if (!this.auth.isLoggedIn()) return;
    const version = ++this.version;
    this.loading.set(true);
    this.error.set('');
    if(this.mode==='help')this.requests.add(this.api.getIssueOptions().subscribe({next:response=>{if(version===this.version)this.options.set(response.issue_types||[]);},error:()=>undefined}));
    if(this.mode==='create' && this.orderId)this.readOrder(this.orderId,version);
    const source =
      this.mode === 'detail'
        ? this.api.getMyIssue(this.issueId)
        : this.mode === 'create'
        ? this.api.getIssueOptions()
        : this.api.getMyIssues();
    this.requests.add(
      source.pipe(timeout(15000)).subscribe({
        next: (response) => {
          if (version !== this.version) return;
          this.loading.set(false);
          if (this.mode === 'detail'){this.issue.set(response);if(response.order)this.readOrder(response.order,version);}
          else if (this.mode === 'create')
            this.options.set(response.issue_types || []);
          else
            this.issues.set(
              Array.isArray(response) ? response : response.results || []
            );
        },
        error: (error) => {
          if (version !== this.version) return;
          this.loading.set(false);
          if ([401, 403, 404].includes(error.status)) {
            this.issue.set(null);
            this.issues.set([]);
            this.orderContext.set(null);
          }
          this.error.set(
            error.status === 404
              ? 'This issue could not be found.'
              : error.status === 403
              ? 'This issue is not available to your account.'
              : 'Support records could not refresh. Try again.'
          );
        },
      })
    );
  }
  private readOrder(id:string,version:number):void {
    this.requests.add(this.orderApi.getOrder(id).subscribe({next:order=>{if(version===this.version)this.orderContext.set(order);},error:()=>{if(version===this.version)this.orderContext.set(null);}}));
  }
  startIssue(type:string):void {
    const order=this.recentOrder();
    if(!order?.id){this.router.navigate(['/orders']);return;}
    this.router.navigate(['/order',order.id,'issue'],{queryParams:{type}});
  }
  optionIcon(type:string):string {return /delivery/.test(type)?'truck':/payment|refund/.test(type)?'card':/quality|damaged/.test(type)?'leaf':/missing/.test(type)?'bag':'chat';}
  create(event?: Event): void {
    if (this.pending()) return;
    const errors: Record<string, string> = {};
    if (!this.issueType()) errors['type'] = 'Choose an issue type.';
    if (!this.description().trim())
      errors['description'] = 'Describe what happened.';
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      );
      return;
    }
    const retryTrigger = event?.currentTarget instanceof HTMLFormElement
      ? event.currentTarget.querySelector<HTMLButtonElement>('#issue-submit')
      : document.querySelector<HTMLButtonElement>('#issue-submit');
    const version = this.version;
    this.pending.set(true);
    this.error.set('');
    this.requests.add(
      this.api
        .createIssue({
          order: this.orderId,
          issue_type: this.issueType(),
          description: this.description().trim(),
        })
        .subscribe({
          next: (issue) => {
            if (version !== this.version) return;
            this.description.set('');
            this.pending.set(false);
            this.submittedIssue.set(issue);
          },
          error: (error) => {
            if (version !== this.version) return;
            this.pending.set(false);
            this.error.set(
              error.error?.error ||
                'Your issue could not be confirmed. Your description stays here. Check your issues before trying again.'
            );
            requestAnimationFrame(() => {
              if (version === this.version && retryTrigger?.isConnected) retryTrigger.focus();
            });
          },
        })
    );
  }
  send(event?: Event): void {
    if (this.pending() || !this.message().trim()) return;
    const retryTrigger = event?.currentTarget instanceof HTMLFormElement
      ? event.currentTarget.querySelector<HTMLButtonElement>('#issue-message-submit')
      : document.querySelector<HTMLButtonElement>('#issue-message-submit');
    const version = this.version;
    this.pending.set(true);
    this.error.set('');
    this.requests.add(
      this.api.sendIssueMessage(this.issueId, this.message().trim()).subscribe({
        next: () => {
          if (version !== this.version) return;
          this.pending.set(false);
          this.message.set('');
          this.load();
        },
        error: (error) => {
          if (version !== this.version) return;
          this.pending.set(false);
          this.error.set(
            error.error?.error ||
              'This message could not be confirmed. Refresh the thread before trying again.'
          );
          requestAnimationFrame(() => {
            if (version === this.version && retryTrigger?.isConnected) retryTrigger.focus();
          });
        },
      })
    );
  }
  upload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.pending()) return;
    this.fileError.set('');
    if (file.size > 10 * 1024 * 1024) {
      this.fileError.set('Choose an attachment smaller than 10 MB.');
      input.value = '';
      return;
    }
    this.pending.set(true);
    this.requests.add(
      this.api.uploadIssueAttachment(this.issueId, file).subscribe({
        next: () => {
          this.pending.set(false);
          input.value = '';
          this.load();
        },
        error: (error) => {
          this.pending.set(false);
          this.fileError.set(
            error.error?.error || 'Attachment could not be saved. Try again.'
          );
        },
      })
    );
  }
  date(value: string): string {
    return value ? new Date(value).toLocaleString() : '';
  }
  @HostListener('window:beforeunload', ['$event'])
  warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (!(this.pending() || !!this.description().trim() || !!this.message().trim())) return;
    event.preventDefault();
    event.returnValue = '';
  }

  async canLeave(): Promise<boolean> {
    if (this.pending()) return false;
    if (!this.description().trim() && !this.message().trim()) return true;
    return this.ui.confirmDiscardDraft();
  }
  leave(): void {
    this.router.navigate(['/issues']);
  }
  ngOnDestroy(): void {
    this.version++;
    this.requests.unsubscribe();
  }
}
