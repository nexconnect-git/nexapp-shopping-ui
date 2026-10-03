const FIELDS = [
  'page',
  'search',
  'searchQuery',
  'statusFilter',
  'filterStatus',
  'filterType',
  'typeFilter',
  'methodFilter',
  'verifiedFilter',
  'categoryFilter',
  'vendorFilter',
  'customerFilter',
  'partnerFilter',
  'dateFrom',
  'dateTo',
  'amountMin',
  'amountMax',
  'issueState',
  'deliveryState',
  'ordering',
  'state',
  'activeTab',
  'selectedType',
  'userFilter',
  'assignedToFilter',
  'entityIdFilter',
  'entityType',
  'action',
  'orderFilter',
  'ownerFilter',
  'queueFilter',
  'priorityFilter',
  'dueFilter',
];
export const QUERY_FIELDS: Record<string, string[]> = {
  state: ['state'],
  tab: ['activeTab'],
  assigned_to: ['assignedToFilter'],
  partner: ['partnerFilter'],
  entity_id: ['entityIdFilter'],
  entity_type: ['entityType'],
  action: ['action'],
  order: ['orderFilter'],
  assignee: ['ownerFilter'],
  queue: ['queueFilter'],
  priority: ['priorityFilter'],
  due: ['dueFilter'],
  search: ['search', 'searchQuery'],
  status: ['statusFilter', 'filterStatus'],
  vendor: ['vendorFilter'],
  customer: ['customerFilter'],
  delivery_partner: ['partnerFilter'],
  method: ['methodFilter'],
  verified: ['verifiedFilter'],
  issue_state: ['issueState'],
  delivery_state: ['deliveryState'],
  ordering: ['ordering'],
  date_from: ['dateFrom'],
  date_to: ['dateTo'],
  amount_min: ['amountMin'],
  amount_max: ['amountMax'],
};
type StateTarget = Record<string, unknown>;

export function applyListState(
  target: StateTarget,
  values: Record<string, unknown>
) {
  for (const [key, value] of Object.entries(values)) {
    if (
      !FIELDS.includes(key) ||
      !(key in target) ||
      (typeof value !== 'string' && typeof value !== 'number')
    )
      continue;
    if (
      key === 'page' &&
      (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
    )
      continue;
    const current = target[key];
    if (typeof current === 'function' && 'set' in current)
      (current as unknown as { set(value: unknown): void }).set(value);
    else if (typeof current === typeof value) target[key] = value;
  }
}

export const LIST_STATE_FIELDS = FIELDS;
