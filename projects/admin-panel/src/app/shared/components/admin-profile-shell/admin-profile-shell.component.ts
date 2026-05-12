import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface AdminProfileBadge {
  label: string;
  className?: string;
}

export interface AdminProfileMetric {
  label: string;
  value: string | number;
  subtext?: string;
  icon: string;
  tone?: 'cyan' | 'green' | 'warm' | 'slate';
  priority?: boolean;
}

export interface AdminProfileTab {
  id: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-admin-profile-shell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-profile-shell.component.html',
  styleUrl: './admin-profile-shell.component.scss'
})
export class AdminProfileShellComponent {
  @Input() loading = false;
  @Input() loadingLabel = 'Loading profile...';
  @Input() title = '';
  @Input() subtitle = '';
  @Input() avatarText = '';
  @Input() avatarImage = '';
  @Input() avatarBg = '#06b6d4';
  @Input() badges: AdminProfileBadge[] = [];
  @Input() metrics: AdminProfileMetric[] = [];
  @Input() tabs: AdminProfileTab[] = [];
  @Input() activeTab = 'overview';

  @Output() tabChange = new EventEmitter<string>();
}
