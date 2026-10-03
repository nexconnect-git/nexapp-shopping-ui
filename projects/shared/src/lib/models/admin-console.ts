export interface AdminIdentity {
  superuser: boolean;
  permissions: string[];
  catalog: {key: string; label: string}[];
}
export interface AdminSearchResult { group: string; label: string; detail: string; route: string; }
export interface DispatchOrder {
  id: string; order_number: string; status: string; vendor_name: string; customer_name: string;
  partner_name: string | null; partner_id: string | null; ready_at: string | null; deadline: string | null;
  delayed: boolean; priority: string; escalated_at: string | null; notes: string; can_assign: boolean; can_unassign: boolean;
}
export interface DispatchPartner { id: string; name: string; status: string; workload: number; capacity: number; distance_km: number | null; available: boolean; }
export interface DispatchConsole { results: DispatchOrder[]; partners: DispatchPartner[]; count: number; generated_at: string; pickup_sla_minutes: number; }
export interface FinanceSummary {
  verified_received: string; verified_online: string; pending_online: number; unsettled_cod: string; unsettled_cod_count: number;
  failed_sessions: number; refund_requested: string; refund_processed: string; vendor_payable: string;
  partner_payable: string; payout_exceptions: number; generated_at: string;
}
export interface FinanceException { id: string; type: string; label: string; amount: string; route: string; reason?: string; }
export interface FinanceConsole { summary: FinanceSummary; exceptions: FinanceException[]; scope: string; }
export interface AdminProfileContext {
  user: { id: string; name: string; role: string; email: string; phone: string };
  metrics?: Record<string, number | string>;
  orders?: { id: string; order_number: string; status: string; total: string; placed_at: string }[];
  activities: { id: string; summary: string; actor_name?: string; created_at: string; action: string }[];
  related?: { label: string; count: number; route: string }[];
  documents?: { id: string; document_type: string; status: string; expires_on: string | null; expired: boolean; file: string }[];
  generated_at: string;
}
