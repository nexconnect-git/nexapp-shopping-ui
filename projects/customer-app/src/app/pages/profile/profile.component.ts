import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { UiService } from '../../services/ui.service';
import { AppStateService } from '../../services/app-state.service';
import { AuthService } from '../../services/auth.service';
import { OrderService } from '../../services/order.service';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { CustomerIconComponent } from '../../shared/customer-icon/customer-icon.component';
import { CustomerLockedStateComponent } from '../../shared/customer-locked-state/customer-locked-state.component';

@Component({
  standalone: true,
  imports: [
    RouterLink,
    BreadcrumbsComponent,
    CustomerIconComponent,
    CustomerLockedStateComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent {
  quickLinks = [
    {icon:'orders',label:'Your orders',sub:'Track, reorder and find your receipts.',path:'/orders'},
    {icon:'pin',label:'Saved addresses',sub:'The places that matter to you.',path:'/addresses'},
    {icon:'bell',label:'Notifications',sub:'A little update, right when it matters.',path:'/notifications'},
    {icon:'bag',label:'Your basket',sub:'Pick up where you left off.',path:'/cart'},
    {icon:'tag',label:'Explore offers',sub:'Eligible savings from nearby stores.',path:'/explore'},
    {icon:'help',label:'Order help',sub:'Your order issues and messages.',path:'/help'},
  ];
  readonly firstName=computed(()=>this.auth.currentUser()?.name?.trim().split(/\s+/)[0] || 'there');
  readonly initials=computed(()=>this.auth.currentUser()?.name?.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase() || 'N');

  totalOrders = computed(() => this.orders.summary()['all'] ?? 0);

  constructor(
    public ui: UiService,
    public state: AppStateService,
    public auth: AuthService,
    public orders: OrderService,
    private router: Router
  ) {}

  editAddress(): void {
    this.router.navigate(['/addresses']);
  }
  async logout(): Promise<void> {
    if (
      await this.ui.confirm({
        title: 'Sign out of this device?',
        eyebrow:'Your account',
        confirmIcon:'logout',
        message:
          'You can sign in again with an email OTP.',
        notice: 'Your saved orders and addresses stay with your account.',
        noticeTone: 'purple',
        confirmText: 'Sign out',
        cancelText: 'Stay signed in',
        tone: 'warning',
      })
    ) {
      this.auth.logout();
      this.router.navigate(['/account']);
    }
  }

  editProfile(): void {
    this.ui.openEdit('profile');
  }

  viewActivity(): void {
    this.router.navigate(['/orders']);
  }

  disabledFeature(label: string): void {
    this.state.showToast(`${label} is not available yet.`, 'info');
  }
}
