export type ProfileFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'number'
  | 'textarea'
  | 'select'
  | 'date'
  | 'time'
  | 'toggle'
  | 'file'
  | 'currency'
  | 'map';

export type ProfileStatusTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'purple';

export interface ProfileBadge {
  label: string;
  tone?: ProfileStatusTone;
}

export interface ProfileMetric {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: string;
  tone?: ProfileStatusTone;
}

export interface ProfileTab {
  id: string;
  label: string;
  icon?: string;
}

export interface ProfileHeroAction {
  id: string;
  label: string;
  icon?: string;
  variant?: 'primary' | 'outline' | 'soft' | 'danger';
}

export interface ProfileDisplayField {
  label: string;
  value: unknown;
  href?: string;
  icon?: string;
  tone?: ProfileStatusTone;
  copyable?: boolean;
}

export interface ProfileDisplaySection {
  id: string;
  title: string;
  icon?: string;
  actionLabel?: string;
  editStepId?: string;
  columns?: 1 | 2 | 3;
  fields: ProfileDisplayField[];
}

export interface ProfileChecklistItem {
  label: string;
  status: string;
  completed?: boolean;
  tone?: ProfileStatusTone;
}

export interface ProfileActivityItem {
  title: string;
  description?: string;
  timestamp?: string;
  tone?: ProfileStatusTone;
}

export interface ProfilePasswordNotice {
  enabled: boolean;
  title: string;
  message: string;
  actionLabel?: string;
  secretLabel?: string;
  secretValue?: string;
}

export interface DynamicProfileConfig {
  entityName: string;
  entityTypeLabel: string;
  subtitle?: string;
  avatarUrl?: string;
  coverUrl?: string;
  avatarInitials?: string;
  avatarIcon?: string;
  badges?: ProfileBadge[];
  breadcrumbs?: Array<{ label: string; link?: string }>;
  actions?: ProfileHeroAction[];
  metrics?: ProfileMetric[];
  tabs?: ProfileTab[];
  activeTabId?: string;
  passwordNotice?: ProfilePasswordNotice;
  checklistTitle?: string;
  checklistCompletion?: number;
  checklist?: ProfileChecklistItem[];
  sections?: ProfileDisplaySection[];
  activities?: ProfileActivityItem[];
  footerNote?: string;
}

export interface DynamicProfileEntity {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface ProfileFormField {
  key: string;
  label: string;
  type: ProfileFieldType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: Array<{ label: string; value: unknown }>;
  colSpan?: 1 | 2;
  prefix?: string;
  suffix?: string;
}

export interface ProfileFormSection {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  columns?: 1 | 2;
  fields: ProfileFormField[];
}

export interface ProfileWizardStep {
  id: string;
  label: string;
  icon?: string;
  sections: ProfileFormSection[];
}

export interface DynamicEditConfig {
  title: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; link?: string }>;
  steps: ProfileWizardStep[];
  submitLabel?: string;
  saveDraftLabel?: string;
  cancelLabel?: string;
}

export interface ReviewSection {
  id: string;
  title: string;
  icon?: string;
  editStepId?: string;
  fields: ProfileDisplayField[];
}

export interface ReviewAttentionItem {
  title: string;
  description?: string;
  tone?: ProfileStatusTone;
}

export interface DynamicReviewConfig {
  title: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; link?: string }>;
  profileSummary: DynamicProfileConfig;
  completionPercent?: number;
  readinessLabel?: string;
  readinessTone?: ProfileStatusTone;
  warning?: ProfilePasswordNotice;
  sections: ReviewSection[];
  attentionItems?: ReviewAttentionItem[];
  statusValue?: string;
  statusOptions?: Array<{ label: string; value: string }>;
  submitLabel?: string;
  saveDraftLabel?: string;
}
