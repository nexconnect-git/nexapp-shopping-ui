import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  apiErrorMessage,
  AuthService,
  VendorWorkspace,
  VendorWorkspaceApi,
} from '@shared/public-api';
@Injectable({ providedIn: 'root' })
export class VendorContextService {
  private readonly api = inject(VendorWorkspaceApi);
  private readonly auth = inject(AuthService);
  private readonly destroy = inject(DestroyRef);
  readonly context = signal<VendorWorkspace | null>(null);
  readonly stale = signal(false);
  readonly operatingLabel = computed(() => {
    if (this.stale()) return 'Store status unavailable';
    if (!this.context()) return 'Checking store status';
    return (
      this.context()?.operating.effective_status?.label ||
      'Store status unavailable'
    );
  });
  readonly operatingReason = computed(() =>
    this.stale()
      ? 'Last known settings remain below. Refresh to confirm the current state.'
      : this.context()?.operating.effective_status?.reason ||
        'The server has not confirmed the effective operating state.'
  );
  readonly error = signal('');
  readonly busy = signal(false);
  private generation = 0;
  private session = 0;
  private userId = '';
  constructor() {
    effect(() => {
      const user = this.auth.user(),
        id = user?.role === 'vendor' && this.auth.isLoggedIn() ? user.id : '';
      if (id !== this.userId) {
        this.userId = id;
        this.session++;
        this.generation++;
        this.context.set(null);
        this.stale.set(false);
        this.error.set('');
        this.busy.set(false);
      }
      if (id) this.refresh();
    });
  }
  refresh(preserveError = false): void {
    if (!this.userId) return;
    const generation = ++this.generation,
      session = this.session;
    this.api
      .context()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (context) => {
          if (generation === this.generation && session === this.session) {
            this.context.set(context);
            this.stale.set(false);
            if (!preserveError) this.error.set('');
          }
        },
        error: (failure) => {
          if (
            generation === this.generation &&
            session === this.session
          ) {
            this.stale.set(true);
            if (!preserveError) this.error.set(
              apiErrorMessage(
                failure,
                'Store information is unavailable. Retry.'
              )
            );
          }
        },
      });
  }
  operate(values: {
    is_open?: boolean;
    is_accepting_orders?: boolean;
    closing_time?: string;
  }): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    const session = this.session;
    this.generation++;
    this.api
      .operate(values)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result) => {
          if (session !== this.session) return;
          this.generation++;
          this.context.set(result.workspace);
          this.stale.set(false);
          this.busy.set(false);
        },
        error: (failure) => {
          if (session !== this.session) return;
          this.error.set(
            apiErrorMessage(failure, 'Operating state was not changed.')
          );
          this.busy.set(false);
          this.refresh(true);
        },
      });
  }
  reviewInventory(): void {
    const context = this.context();
    if (!context || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    const session = this.session;
    this.generation++;
    this.api
      .reviewInventory(context)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result) => {
          if (session !== this.session) return;
          this.generation++;
          this.context.set(result);
          this.stale.set(false);
          this.busy.set(false);
        },
        error: (failure) => {
          if (session !== this.session) return;
          this.error.set(
            apiErrorMessage(
              failure,
              'Inventory changed. Refresh before confirming review.'
            )
          );
          this.busy.set(false);
          this.refresh(true);
        },
      });
  }
}
