import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-url.token';
import { Product, Category, CatalogProposal, VendorAnalytics } from '../models';
import { AuthResponse } from '../models';
import { VendorPayoutPage, VendorCoupon } from '../models/vendor-workspace';
import { VendorBulkStockResult, VendorCatalogPage, VendorDocument, VendorNotificationPage, VendorOrderCommand, VendorOrderSnapshot, VendorPaged, VendorPayout, VendorProductPage, VendorReviewPage, VendorTicket, VendorTransaction, VendorWorkspace } from '../models/vendor-workspace';

export type VendorQuery = Record<string, string | number | boolean | null | undefined>;

@Injectable({ providedIn: 'root' })
export class VendorWorkspaceApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  changePassword(currentPassword: string, newPassword: string): Observable<AuthResponse> { return this.http.post<AuthResponse>(`${this.base}/auth/change-password/`, { current_password:currentPassword, new_password:newPassword }, {withCredentials:true}); }
  requestRecovery(email: string): Observable<{detail:string}> { return this.http.post<{detail:string}>(`${this.base}/auth/password-reset/`, {email,role:'vendor'}); }
  resetPassword(token: string, password: string): Observable<{detail:string}> { return this.http.post<{detail:string}>(`${this.base}/auth/password-reset/confirm/`, {token,new_password:password}); }
  createTicket(values: {subject:string;message:string;category:string;priority:string}): Observable<VendorTicket> { return this.http.post<VendorTicket>(`${this.base}/support/tickets/`,values); }
  private params(query: VendorQuery): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) if (value !== null && value !== undefined && value !== '') params = params.set(key, String(value));
    return params;
  }
  coupons(query:VendorQuery={}):Observable<VendorPaged<VendorCoupon>>{return this.http.get<VendorPaged<VendorCoupon>>(`${this.base}/vendors/coupons/`,{params:this.params(query)});}
  saveCoupon(id:string|null,values:Record<string,unknown>):Observable<VendorCoupon>{return id?this.http.patch<VendorCoupon>(`${this.base}/vendors/coupons/${encodeURIComponent(id)}/`,values):this.http.post<VendorCoupon>(`${this.base}/vendors/coupons/`,values);}
  couponCommand(id:string,command:'duplicate'|'reactivate'):Observable<VendorCoupon>{return this.http.post<VendorCoupon>(`${this.base}/vendors/coupons/${encodeURIComponent(id)}/${command}/`,{});}
  deleteCoupon(id:string):Observable<void>{return this.http.delete<void>(`${this.base}/vendors/coupons/${encodeURIComponent(id)}/`);}
  storeSettings():Observable<Record<string,unknown>> {return this.http.get<Record<string,unknown>>(`${this.base}/vendors/store-settings/`);}
  saveStoreSettings(values:Record<string,unknown>):Observable<Record<string,unknown>> {return this.http.patch<Record<string,unknown>>(`${this.base}/vendors/store-settings/`,values);}
  account():Observable<import('../models').User>{return this.http.get<import('../models').User>(`${this.base}/auth/profile/`);}
  saveAccount(values:{first_name:string;last_name:string;phone:string;email:string}):Observable<import('../models').User>{return this.http.put<import('../models').User>(`${this.base}/auth/profile/`,values);}
  uploadStoreImage(file:File,kind:'logo'|'banner'):Observable<Record<string,unknown>>{const form=new FormData();form.append(kind,file);return this.http.patch<Record<string,unknown>>(`${this.base}/vendors/profile/`,form);}
  updateProfile(values:Record<string,unknown>):Observable<VendorWorkspace['vendor']> {return this.http.patch<VendorWorkspace['vendor']>(`${this.base}/vendors/profile/`,values);}
  analytics(days:string):Observable<VendorAnalytics>{return this.http.get<VendorAnalytics>(`${this.base}/vendors/analytics/`,{params:{days}});}
  categories():Observable<Category[]>{return this.http.get<Category[]>(`${this.base}/vendors/categories/`);}
  proposals(query:VendorQuery={}):Observable<VendorPaged<CatalogProposal>>{return this.http.get<VendorPaged<CatalogProposal>>(`${this.base}/vendors/catalog-proposals/`,{params:this.params(query)});}
  createProposal(items:Record<string,unknown>[]):Observable<CatalogProposal>{return this.http.post<CatalogProposal>(`${this.base}/vendors/catalog-proposals/`,{items});}
  context(): Observable<VendorWorkspace> { return this.http.get<VendorWorkspace>(`${this.base}/vendors/workspace/`); }
  operate(values: { is_open?: boolean; is_accepting_orders?: boolean; closing_time?: string }): Observable<VendorWorkspace['vendor'] & { workspace: VendorWorkspace }> { return this.http.post<VendorWorkspace['vendor'] & { workspace: VendorWorkspace }>(`${this.base}/vendors/store-status/`, values); }
  reviewInventory(context: VendorWorkspace): Observable<VendorWorkspace> { return this.http.post<VendorWorkspace>(`${this.base}/vendors/inventory/review/`, { confirmed: true, product_count: context.inventory.total, updated_at: context.inventory.updated_at }); }
  products(query: VendorQuery = {}): Observable<VendorProductPage> { return this.http.get<VendorProductPage>(`${this.base}/vendors/products/`, { params: this.params(query) }); }
  product(id: string): Observable<Product> { return this.http.get<Product>(`${this.base}/vendors/products/${encodeURIComponent(id)}/`); }
  stock(updates: { id: string; stock: number; expected_stock?: number }[]): Observable<VendorBulkStockResult> { return this.http.post<VendorBulkStockResult>(`${this.base}/vendors/bulk-update-stock/`, { updates }); }
  liveOrders(): Observable<VendorOrderSnapshot[]> { return this.http.get<VendorOrderSnapshot[]>(`${this.base}/vendors/live-orders/`); }
  orders(query: VendorQuery = {}): Observable<VendorPaged<VendorOrderSnapshot>> { return this.http.get<VendorPaged<VendorOrderSnapshot>>(`${this.base}/vendors/orders/`, { params: this.params(query) }); }
  order(id: string): Observable<VendorOrderSnapshot> { return this.http.get<VendorOrderSnapshot>(`${this.base}/vendors/orders/${encodeURIComponent(id)}/`); }
  command(id: string, action: VendorOrderCommand, data: Record<string, string> = {}): Observable<VendorOrderSnapshot> {
    const path = `${this.base}/vendors/orders/${encodeURIComponent(id)}/`;
    if (action === 'set_status' || action === 'cancel_order') return this.http.patch<VendorOrderSnapshot>(`${path}status/`, action === 'cancel_order' ? { status: 'cancelled', cancel_reason: data['reason'] } : { status: data['status'] });
    return this.http.post<VendorOrderSnapshot>(`${path}${action.replaceAll('_', '-')}/`, data);
  }
  payouts(query: VendorQuery = {}): Observable<VendorPayoutPage> { return this.http.get<VendorPayoutPage>(`${this.base}/vendors/payouts/`, { params: this.params(query) }); }
  payoutCommand(id: string, action: 'approve' | 'decline' | 'verify-credit', reason = ''): Observable<VendorPayout> { return this.http.post<VendorPayout>(`${this.base}/vendors/payouts/${encodeURIComponent(id)}/${action}/`, { reason }); }
  payoutStatement(id: string): Observable<Blob> { return this.http.get(`${this.base}/vendors/payouts/${encodeURIComponent(id)}/statement/`, { responseType:'blob' }); }
  transactions(query: VendorQuery = {}): Observable<VendorPaged<VendorTransaction>> { return this.http.get<VendorPaged<VendorTransaction>>(`${this.base}/vendors/wallet/transactions/`, { params: this.params(query) }); }
  notifications(query: VendorQuery = {}): Observable<VendorNotificationPage> { return this.http.get<VendorNotificationPage>(`${this.base}/notifications/list/`, { params: this.params(query) }); }
  unread(): Observable<{ unread_count: number }> { return this.http.get<{ unread_count: number }>(`${this.base}/notifications/unread-count/`); }
  markRead(id: string): Observable<unknown> { return this.http.patch(`${this.base}/notifications/${encodeURIComponent(id)}/read/`, {}); }
  markAllRead(): Observable<unknown> { return this.http.post(`${this.base}/notifications/mark-all-read/`, {}); }
  tickets(query: VendorQuery = {}): Observable<VendorPaged<VendorTicket>> { return this.http.get<VendorPaged<VendorTicket>>(`${this.base}/support/tickets/`, { params: this.params(query) }); }
  ticket(id: string): Observable<VendorTicket> { return this.http.get<VendorTicket>(`${this.base}/support/tickets/${encodeURIComponent(id)}/`); }
  reviews(vendorId: string, query: VendorQuery = {}): Observable<VendorReviewPage> { return this.http.get<VendorReviewPage>(`${this.base}/vendors/${encodeURIComponent(vendorId)}/reviews/`, { params: this.params(query) }); }
  catalog(query: VendorQuery = {}): Observable<VendorCatalogPage> { return this.http.get<VendorCatalogPage>(`${this.base}/vendors/catalog-products/available/`, { params: this.params(query) }); }
  drafts(query: VendorQuery={}): Observable<VendorProductPage> { return this.http.get<VendorProductPage>(`${this.base}/vendors/inherited-products/`,{params:this.params({approval_status:'draft',...query,page:query['page']||1})}); }
  createDraftBatch(ids:string[],batchId:string): Observable<{batch_id:string;variants:Product[]}> { return this.http.post<{batch_id:string;variants:Product[]}>(`${this.base}/vendors/inherited-products/draft-batch/`,{catalog_product_ids:ids,batch_id:batchId}); }
  updateDraft(id:string,data:Record<string,unknown>): Observable<Product> { return this.http.patch<Product>(`${this.base}/vendors/inherited-products/${encodeURIComponent(id)}/`,data); }
  duplicateDraft(id:string): Observable<Product> { return this.http.post<Product>(`${this.base}/vendors/inherited-products/${encodeURIComponent(id)}/duplicate/`,{}); }
  submitDrafts(ids:string[],note:string): Observable<Product[]> { return this.http.post<Product[]>(`${this.base}/vendors/inherited-products/submit/`,{product_ids:ids,approval_note:note}); }
  deleteProduct(id:string): Observable<void> { return this.http.delete<void>(`${this.base}/vendors/products/${encodeURIComponent(id)}/`); }
  updateProduct(id:string,data:Record<string,unknown>): Observable<Product> { return this.http.patch<Product>(`${this.base}/vendors/products/${encodeURIComponent(id)}/`,data); }
  deleteProductImage(productId:string,imageId:string):Observable<void>{return this.http.delete<void>(`${this.base}/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}/`);}
  primaryProductImage(productId:string,imageId:string):Observable<unknown>{return this.http.patch(`${this.base}/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}/`,{is_primary:true});}
  uploadProductImage(id:string,file:File,mode?:Product['inheritance_mode']): Observable<unknown> { const data=new FormData();data.append('image',file);if(mode)data.append('inheritance_mode',mode);return this.http.post(`${this.base}/products/${encodeURIComponent(id)}/images/`,data); }
  draftsLegacy(): Observable<Product[]> { return this.http.get<Product[]>(`${this.base}/vendors/inherited-products/`, { params: { approval_status: 'draft' } }); }
  documents(): Observable<VendorDocument[]> { return this.http.get<VendorDocument[]>(`${this.base}/vendors/onboarding/documents/`); }
  uploadDocument(file: File, type: string): Observable<VendorDocument> { const data = new FormData(); data.append('file', file); data.append('document_type', type); return this.http.post<VendorDocument>(`${this.base}/vendors/onboarding/documents/`, data); }
  contact(subject: string, message: string): Observable<VendorTicket> { return this.http.post<VendorTicket>(`${this.base}/vendors/onboarding/contact/`, { subject, message, category: 'account', priority: 'medium' }); }
}
