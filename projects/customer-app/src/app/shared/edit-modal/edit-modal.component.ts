import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiService } from '../../services/ui.service';
import { AuthService } from '../../services/auth.service';
import { AppStateService } from '../../services/app-state.service';

@Component({
  selector: 'fd-edit-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './edit-modal.component.html',
  styleUrls: ['./edit-modal.component.scss'],
})
export class EditModalComponent {
  private auth = inject(AuthService);
  private state = inject(AppStateService);

  name = this.auth.currentUser()?.name || '';
  email = this.auth.currentUser()?.email || '';
  phone = this.auth.currentUser()?.phone || '';
  addressLabel = this.state.activeAddress()?.label || '';
  addressLine = this.state.activeAddress()?.line || '';
  paymentName = this.state.paymentMethods()[0]?.label || '';
  paymentId = 'Payment method';

  constructor(public ui: UiService) {}

  title(): string {
    if (this.ui.editModal() === 'profile') return 'Edit Profile';
    if (this.ui.editModal() === 'address') return 'Edit Address';
    if (this.ui.editModal() === 'payment') return 'Edit Payment Method';
    return 'Edit';
  }

  save(event: Event): void {
    event.preventDefault();
    if (this.ui.editModal() === 'profile') {
      this.auth.updateProfile(
        { name: this.name, email: this.email, phone: this.phone },
        () => this.state.showToast('Profile updated successfully'),
        (message) => this.state.showToast(message),
      );
      this.ui.closeEdit();
      return;
    }
    this.state.showToast('Changes saved successfully');
    this.ui.closeEdit();
  }
}
