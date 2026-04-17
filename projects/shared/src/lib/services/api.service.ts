import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-url.token';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = (() => {
    const base = inject(API_BASE_URL);
    // Absolute URL (mobile/Capacitor) — use as-is; relative URL (web) — prepend /sa subpath
    return base.startsWith('http') ? base : '/sa' + base;
  })();

  readonly cartCount = signal(0);
  readonly unreadNotifications = signal(0);
  readonly activeIssue = signal<any>(null);

  /** Shared cached request for admin stats — expires after 30s. */
  private _adminStatsCache$?: Observable<any>;
  private _adminStatsCacheTime = 0;
  private readonly _STATS_TTL_MS = 30_000;

  constructor(private http: HttpClient) {}

  refreshCartCount() {
    this.getCart().subscribe({
      next: (cart) => this.cartCount.set((cart.items || []).length),
      error: () => {}
    });
  }

  refreshUnreadCount() {
    this.getUnreadCount().subscribe({
      next: (r) => this.unreadNotifications.set(r.count ?? 0),
      error: () => {}
    });
  }

  // Auth
  login(data: { username: string; password: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/login/`, data);
  }

  register(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/register/`, data);
  }

  getProfile(): Observable<any> {
    return this.http.get(`${this.baseUrl}/auth/profile/`);
  }

  updateProfile(data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/auth/profile/`, data);
  }

  changePassword(data: { current_password: string; new_password: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/change-password/`, data);
  }

  requestPasswordReset(email: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/password-reset/`, { email });
  }

  confirmPasswordReset(token: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/password-reset/confirm/`, { token, new_password: newPassword });
  }

  checkSetup(): Observable<any> {
    return this.http.get(`${this.baseUrl}/auth/setup/`);
  }

  setupSuperuser(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/setup/`, data);
  }

  uploadAvatar(file: File): Observable<any> {
    const fd = new FormData();
    fd.append('avatar', file);
    return this.http.patch(`${this.baseUrl}/auth/profile/`, fd);
  }

  uploadVendorLogo(vendorId: string, file: File): Observable<any> {
    const fd = new FormData();
    fd.append('logo', file);
    return this.http.patch(`${this.baseUrl}/admin/vendors/${vendorId}/`, fd);
  }

  uploadVendorLogoSelf(file: File): Observable<any> {
    const fd = new FormData();
    fd.append('logo', file);
    return this.http.patch(`${this.baseUrl}/vendors/profile/`, fd);
  }

  // Addresses
  getAddresses(): Observable<any> {
    return this.http.get(`${this.baseUrl}/auth/addresses/`);
  }

  createAddress(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/addresses/`, data);
  }

  updateAddress(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/auth/addresses/${id}/`, data);
  }

  deleteAddress(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/auth/addresses/${id}/`);
  }

  // Vendors
  getVendors(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/vendors/list/`, { params: httpParams });
  }

  getNearbyVendors(lat: number, lng: number, radius?: number, category?: string): Observable<any> {
    let params = new HttpParams().set('lat', lat.toString()).set('lng', lng.toString());
    if (radius) params = params.set('radius_km', radius.toString());
    if (category && category !== 'all') params = params.set('category', category);
    return this.http.get(`${this.baseUrl}/vendors/nearby/`, { params });
  }

  getVendor(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/vendors/${id}/`);
  }

  registerVendor(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/vendors/register/`, data);
  }

  getVendorDashboard(): Observable<any> {
    return this.http.get(`${this.baseUrl}/vendors/dashboard/`);
  }

  getVendorDashboardStats(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/vendors/dashboard/`, { params: httpParams });
  }

  getVendorProfile(): Observable<any> {
    return this.http.get(`${this.baseUrl}/vendors/profile/`);
  }

  updateVendorProfile(data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/vendors/profile/`, data);
  }

  getVendorProducts(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(k => {
        if (params[k] !== null && params[k] !== undefined && params[k] !== '') {
          httpParams = httpParams.set(k, params[k]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/vendors/products/`, { params: httpParams });
  }

  createProduct(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/vendors/products/`, data);
  }

  updateProduct(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/vendors/products/${id}/`, data);
  }

  deleteProduct(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/vendors/products/${id}/`);
  }

  // Product Images
  getProductImages(productId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/products/${productId}/images/`);
  }

  uploadProductImage(productId: string, file: File): Observable<any> {
    const fd = new FormData();
    fd.append('image', file);
    return this.http.post(`${this.baseUrl}/products/${productId}/images/`, fd);
  }

  deleteProductImage(productId: string, imageId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/products/${productId}/images/${imageId}/`);
  }

  generateProductAiImage(data: { product_id: string; prompt: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/products/ai-image/`, data);
  }

  // Stock Management
  updateProductStock(productId: string, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/products/${productId}/stock/`, data);
  }

  getLowStockProducts(): Observable<any> {
    return this.http.get(`${this.baseUrl}/products/low-stock/`);
  }

  bulkUpdateVendorStock(updates: { id: string; stock: number }[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/vendors/bulk-update-stock/`, { updates });
  }

  setStoreStatus(isOpen: boolean, closingTime?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/vendors/store-status/`, {
      is_open: isOpen,
      closing_time: closingTime });
  }

    getVendorOrders(params?: { status?: string; page?: number; page_size?: number; search?: string }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(k => {
        const v = (params as any)[k];
        if (v !== null && v !== undefined && v !== '') httpParams = httpParams.set(k, v);
      });
    }
    return this.http.get(`${this.baseUrl}/vendors/orders/`, { params: httpParams });
  }

  getVendorOrder(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/vendors/orders/${id}/`);
  }

  updateOrderStatus(orderId: string, status: string, cancelReason?: string): Observable<any> {
    const body: any = { status };
    if (cancelReason) body.cancel_reason = cancelReason;
    return this.http.patch(`${this.baseUrl}/vendors/orders/${orderId}/status/`, body);
  }

  getVendorPayouts(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(k => {
        if (params[k] !== null && params[k] !== undefined && params[k] !== '') {
          httpParams = httpParams.set(k, params[k]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/vendors/payouts/`, { params: httpParams });
  }

  getVendorWalletTransactions(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(k => {
        if (params[k] !== null && params[k] !== undefined && params[k] !== '') {
          httpParams = httpParams.set(k, params[k]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/vendors/wallet/transactions/`, { params: httpParams });
  }

  // Invoices
  getInvoices(): Observable<any> {
    return this.http.get(`${this.baseUrl}/invoices/`);
  }

  generateInvoice(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/invoices/generate/`, data);
  }

  downloadInvoice(invoiceId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/invoices/${invoiceId}/download/`, { responseType: 'blob' });
  }

  // Push Notifications (FCM)
  registerDeviceToken(data: { token: string; platform: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/notifications/device-token/`, data);
  }

  // Vendor Categories
  getVendorCategories(): Observable<any> {
    return this.http.get(`${this.baseUrl}/vendors/categories/`);
  }

  createVendorCategory(data: { name: string; slug?: string; description?: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/vendors/categories/`, data);
  }

  createVendorSubcategory(parentId: string, data: { name: string; slug?: string; description?: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/vendors/categories/${parentId}/subcategories/`, data);
  }

  // Products
  getCategories(): Observable<any> {
    return this.http.get(`${this.baseUrl}/products/categories/`);
  }

  getProducts(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/products/list/`, { params: httpParams });
  }

  getProduct(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/products/${id}/`);
  }

  getFeaturedProducts(): Observable<any> {
    return this.http.get(`${this.baseUrl}/products/featured/`);
  }

  // Cart
  getCart(): Observable<any> {
    return this.http.get(`${this.baseUrl}/orders/cart/`);
  }

  addToCart(productId: string, quantity: number = 1): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders/cart/add/`, { product_id: productId, quantity });
  }

  updateCartItem(id: string, quantity: number): Observable<any> {
    return this.http.patch(`${this.baseUrl}/orders/cart/items/${id}/`, { quantity });
  }

  removeCartItem(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/orders/cart/items/${id}/`);
  }

  clearCart(): Observable<any> {
    return this.http.delete(`${this.baseUrl}/orders/cart/clear/`);
  }

  // Orders
  getCancellationPolicy(): Observable<any> {
    return this.http.get(`${this.baseUrl}/orders/cancellation-policy/`);
  }

  getDeliveryFeePreview(addressId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/orders/delivery-fee-preview/?address_id=${addressId}`);
  }

  // Loyalty
  getLoyalty(): Observable<any> {
    return this.http.get(`${this.baseUrl}/auth/loyalty/`);
  }

  // Wallet
  getWallet(): Observable<any> {
    return this.http.get(`${this.baseUrl}/auth/wallet/`);
  }

  initiateWalletTopUp(amount: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/wallet/topup/`, { amount });
  }

  verifyWalletTopUp(data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    amount: number;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/wallet/verify-topup/`, data);
  }

  createOrder(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders/create/`, data);
  }

  initiateCheckoutPayment(data: { delivery_address_id: string; coupon_code?: string; wallet_amount?: number }): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders/initiate-checkout-payment/`, data);
  }

  createRazorpayOrder(orderId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders/${orderId}/create-payment/`, {});
  }

  verifyRazorpayPayment(orderId: string, razorpay_payment_id: string, razorpay_signature: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders/${orderId}/verify-payment/`, {
      razorpay_payment_id,
      razorpay_signature,
    });
  }

  getOrders(status?: string): Observable<any> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get(`${this.baseUrl}/orders/list/`, { params });
  }

  getOrder(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/orders/${id}/`);
  }

  reorder(orderId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders/${orderId}/reorder/`, {});
  }

  cancelOrder(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders/${id}/cancel/`, {});
  }

  getOrderTracking(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/orders/${id}/tracking/`);
  }

  submitOrderRating(orderId: string, rating: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders/${orderId}/rate/`, { rating });
  }

  // Order Issues
  getMyIssues(): Observable<any> {
    return this.http.get(`${this.baseUrl}/orders/issues/`);
  }

  getMyIssue(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/orders/issues/${id}/`);
  }

  createIssue(data: { order: string; issue_type: string; description: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders/issues/`, data);
  }

  sendIssueMessage(issueId: string, message: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders/issues/${issueId}/messages/`, { message });
  }

  // Admin Issues
  getAdminIssues(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(k => {
        if (params[k] !== null && params[k] !== undefined && params[k] !== '') {
          httpParams = httpParams.set(k, params[k]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/admin/issues/`, { params: httpParams });
  }

  getAdminIssue(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/admin/issues/${id}/`);
  }

  updateAdminIssue(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/admin/issues/${id}/`, data);
  }

  sendAdminIssueMessage(issueId: string, message: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/issues/${issueId}/messages/`, { message });
  }

  // Banners
  getBanners(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/orders/banners/`);
  }

  // Coupons
  getCoupons(): Observable<any> {
    return this.http.get(`${this.baseUrl}/orders/coupons/`);
  }

  validateCoupon(code: string, cartTotal: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders/coupons/validate/`, { code, cart_total: cartTotal });
  }

  // Vendor coupons
  getVendorCoupons(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(k => {
        if (params[k] !== null && params[k] !== undefined && params[k] !== '') {
          httpParams = httpParams.set(k, params[k]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/vendors/coupons/`, { params: httpParams });
  }

  createVendorCoupon(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/vendors/coupons/`, data);
  }

  updateVendorCoupon(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/vendors/coupons/${id}/`, data);
  }

  deleteVendorCoupon(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/vendors/coupons/${id}/`);
  }

  // Admin coupons
  getAdminCoupons(params?: any): Observable<any> {
    return this.http.get(`${this.baseUrl}/admin/coupons/`, { params });
  }

  createAdminCoupon(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/coupons/`, data);
  }

  updateAdminCoupon(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/admin/coupons/${id}/`, data);
  }

  deleteAdminCoupon(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/admin/coupons/${id}/`);
  }

  // Delivery
  registerDeliveryPartner(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/delivery/register/`, data);
  }

  getDeliveryDashboard(): Observable<any> {
    return this.http.get(`${this.baseUrl}/delivery/dashboard/`);
  }

  getAvailableOrders(): Observable<any> {
    return this.http.get(`${this.baseUrl}/delivery/available-orders/`);
  }

  acceptDelivery(orderId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/delivery/accept/${orderId}/`, {});
  }

  updateDeliveryStatus(orderId: string, status: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/delivery/update-status/${orderId}/`, { status });
  }

  confirmDelivery(orderId: string, otp: string, photo?: File): Observable<any> {
    const fd = new FormData();
    fd.append('otp', otp);
    if (photo) fd.append('photo', photo);
    return this.http.post(`${this.baseUrl}/delivery/confirm/${orderId}/`, fd);
  }

  updateLocation(latitude: number, longitude: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/delivery/update-location/`, { latitude, longitude });
  }

  setAvailability(isOnline: boolean): Observable<any> {
    return this.http.post(`${this.baseUrl}/delivery/set-availability/`, { is_online: isOnline });
  }

  getDeliveryHistory(): Observable<any> {
    return this.http.get(`${this.baseUrl}/delivery/history/`);
  }

  getDeliveryEarnings(): Observable<any> {
    return this.http.get(`${this.baseUrl}/delivery/earnings/`);
  }

  // Assignment-based delivery flow
  getDeliveryRequests(): Observable<any> {
    return this.http.get(`${this.baseUrl}/delivery/requests/`);
  }

  acceptDeliveryRequest(assignmentId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/delivery/requests/${assignmentId}/accept/`, {});
  }

  rejectDeliveryRequest(assignmentId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/delivery/requests/${assignmentId}/reject/`, {});
  }

  cancelDeliveryAssignment(orderId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/delivery/${orderId}/cancel-assignment/`, {});
  }

  setDeliveryOnTheWay(orderId: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/delivery/update-status/${orderId}/`, { status: 'on_the_way' });
  }

  // Vendor: verify pickup OTP from delivery partner
  verifyPickupOtp(orderId: string, otp: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/vendors/orders/${orderId}/verify-pickup-otp/`, { otp });
  }

  // Vendor: initiate (or re-initiate) delivery partner search
  startDeliverySearch(orderId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/vendors/orders/${orderId}/start-delivery-search/`, {});
  }

  // Vendor: cancel an in-progress delivery partner search
  cancelDeliverySearch(orderId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/vendors/orders/${orderId}/cancel-delivery-search/`, {});
  }

  // Payment QR code
  getPaymentQR(orderId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/orders/${orderId}/payment-qr/`);
  }

  // Notifications
  getNotifications(): Observable<any> {
    return this.http.get(`${this.baseUrl}/notifications/list/`);
  }

  markNotificationRead(id: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/notifications/${id}/read/`, {});
  }

  markAllNotificationsRead(): Observable<any> {
    return this.http.post(`${this.baseUrl}/notifications/mark-all-read/`, {});
  }

  getUnreadCount(): Observable<any> {
    return this.http.get(`${this.baseUrl}/notifications/unread-count/`);
  }

  // Admin Users
  getAdminUsers(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/auth/admin-users/`, { params: httpParams });
  }

  createAdminUser(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/admin-users/`, data);
  }

  deleteAdminUser(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/auth/admin-users/${id}/`);
  }

  // Admin
  getAdminStats(): Observable<any> {
    const now = Date.now();
    if (!this._adminStatsCache$ || now - this._adminStatsCacheTime > this._STATS_TTL_MS) {
      this._adminStatsCacheTime = now;
      this._adminStatsCache$ = this.http
        .get(`${this.baseUrl}/admin/stats/`)
        .pipe(shareReplay(1));
    }
    return this._adminStatsCache$;
  }

  getAdminVendors(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/admin/vendors/`, { params: httpParams });
  }

  setVendorStatus(id: string, status: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/vendors/${id}/status/`, { status });
  }

  adminUpdateVendor(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/admin/vendors/${id}/`, data);
  }

  getAdminCustomers(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/admin/customers/`, { params: httpParams });
  }

  getAdminCustomer(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/admin/customers/${id}/`);
  }

  updateAdminCustomer(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/admin/customers/${id}/`, data);
  }

  deleteAdminCustomer(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/admin/customers/${id}/`);
  }

  getAdminCustomerLoyalty(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/admin/customers/${id}/loyalty/`);
  }

  adjustAdminCustomerLoyalty(id: string, data: { operation: 'credit' | 'debit'; amount: number; reason: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/customers/${id}/loyalty/adjust/`, data);
  }

  createAdminDeliveryPartner(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/delivery-partners/`, data);
  }

  getAdminDeliveryPartners(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/admin/delivery-partners/`, { params: httpParams });
  }

  getAdminDeliveryPartner(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/admin/delivery-partners/${id}/`);
  }

  approveDeliveryPartner(id: string, action: 'approve' | 'reject'): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/delivery-partners/${id}/approve/`, { action });
  }

  updateAdminDeliveryPartner(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/admin/delivery-partners/${id}/`, data);
  }

  deleteAdminDeliveryPartner(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/admin/delivery-partners/${id}/`);
  }

  getAdminDeliveryPartnerEarnings(id: string, startDate?: string, endDate?: string): Observable<any> {
    let params = new HttpParams();
    if (startDate) params = params.set('start_date', startDate);
    if (endDate) params = params.set('end_date', endDate);
    return this.http.get(`${this.baseUrl}/admin/delivery-partners/${id}/calculate-earnings/`, { params });
  }

  // Admin Vendors
  getAdminVendor(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/admin/vendors/${id}/`);
  }

  createAdminVendor(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/vendors/`, data);
  }

  updateAdminVendor(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/admin/vendors/${id}/`, data);
  }

  deleteAdminVendor(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/admin/vendors/${id}/`);
  }

  // Vendor Onboarding
  onboardVendor(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/vendors/onboard/`, data);
  }

  getVendorOnboarding(vendorId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/admin/vendors/${vendorId}/onboarding/`);
  }

  updateVendorOnboarding(vendorId: string, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/admin/vendors/${vendorId}/onboarding/`, data);
  }

  reviewVendorKYC(vendorId: string, action: 'approve' | 'reject', rejectionReason?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/vendors/${vendorId}/kyc-review/`, { action, rejection_reason: rejectionReason || '' });
  }

  getVendorBankDetails(vendorId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/admin/vendors/${vendorId}/bank/`);
  }

  updateVendorBankDetails(vendorId: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/admin/vendors/${vendorId}/bank/`, data);
  }

  verifyVendorBank(vendorId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/vendors/${vendorId}/bank/verify/`, {});
  }

  getVendorDocuments(vendorId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/admin/vendors/${vendorId}/documents/`);
  }

  uploadVendorDocument(vendorId: string, data: FormData): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/vendors/${vendorId}/documents/`, data);
  }

  verifyVendorDocument(vendorId: string, docId: string, action: 'verify' | 'reject', rejectionReason?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/vendors/${vendorId}/documents/${docId}/verify/`, { action, rejection_reason: rejectionReason || '' });
  }

  getVendorServiceableAreas(vendorId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/admin/vendors/${vendorId}/serviceable-areas/`);
  }

  addVendorServiceableArea(vendorId: string, data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/vendors/${vendorId}/serviceable-areas/`, data);
  }

  deleteVendorServiceableArea(vendorId: string, areaId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/admin/vendors/${vendorId}/serviceable-areas/${areaId}/`);
  }

  getVendorHolidays(vendorId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/admin/vendors/${vendorId}/holidays/`);
  }

  addVendorHoliday(vendorId: string, data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/vendors/${vendorId}/holidays/`, data);
  }

  deleteVendorHoliday(vendorId: string, holidayId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/admin/vendors/${vendorId}/holidays/${holidayId}/`);
  }

  getVendorAuditLogs(vendorId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/admin/vendors/${vendorId}/audit-logs/`);
  }

  // Admin Vendor Sales Report
  getAdminVendorSalesReport(id: string, params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/admin/vendors/${id}/sales-report/`, { params: httpParams });
  }

  /** Fetch gross sales + order stats for a vendor over a specific date range (used by payout modal). */
  getAdminVendorSalesSummary(vendorId: string, startDate: string, endDate: string): Observable<any> {
    const params = new HttpParams()
      .set('start_date', startDate)
      .set('end_date', endDate);
    return this.http.get(`${this.baseUrl}/admin/vendors/${vendorId}/sales-report/`, { params });
  }

  // Admin Categories
  getAdminCategories(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/admin/categories/`, { params: httpParams });
  }

  createAdminCategory(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/categories/`, data);
  }

  updateAdminCategory(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/admin/categories/${id}/`, data);
  }

  deleteAdminCategory(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/admin/categories/${id}/`);
  }

  // Admin Products
  getAdminProducts(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/admin/products/`, { params: httpParams });
  }

  createAdminProduct(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/products/`, data);
  }

  updateAdminProduct(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/admin/products/${id}/`, data);
  }

  deleteAdminProduct(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/admin/products/${id}/`);
  }

  // Admin Orders
  getAdminOrders(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/admin/orders/`, { params: httpParams });
  }

  getAdminPayments(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/admin/payments/`, { params: httpParams });
  }

  updateAdminOrderStatus(id: string, status: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/admin/orders/${id}/`, { status });
  }

  getAdminOrder(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/admin/orders/${id}/`);
  }

  // Vendor Reviews
  getVendorReviews(vendorId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/vendors/${vendorId}/reviews/`);
  }

  createVendorReview(vendorId: string, data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/vendors/${vendorId}/reviews/`, data);
  }

  // Product Reviews
  getProductReviews(productId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/products/${productId}/reviews/`);
  }

  createProductReview(productId: string, data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/products/${productId}/reviews/`, data);
  }

  // Admin Notifications
  getAdminNotifications(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/admin/notifications/`, { params: httpParams });
  }

  sendAdminNotification(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/notifications/send/`, data);
  }

  deleteAdminNotification(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/admin/notifications/${id}/`);
  }

  // Admin Assets
  getAssets(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/admin/assets/`, { params: httpParams });
  }

  createAsset(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/assets/`, data);
  }

  updateAsset(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/admin/assets/${id}/`, data);
  }

  deleteAsset(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/admin/assets/${id}/`);
  }

  // Support Tickets
  getSupportTickets(): Observable<any> {
    return this.http.get(`${this.baseUrl}/support/tickets/`);
  }

  createSupportTicket(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/support/tickets/`, data);
  }

  getSupportTicket(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/support/tickets/${id}/`);
  }

  updateSupportTicket(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/support/tickets/${id}/`, data);
  }

  // Admin Payouts
  getAdminVendorPayouts(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/admin/payouts/vendors/`, { params: httpParams });
  }

  createAdminVendorPayout(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/payouts/vendors/`, data);
  }

  updateAdminVendorPayout(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/admin/payouts/vendors/${id}/`, data);
  }

  getAdminDeliveryPayouts(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/admin/payouts/delivery/`, { params: httpParams });
  }

  createAdminDeliveryPayout(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/payouts/delivery/`, data);
  }

  updateAdminDeliveryPayout(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/admin/payouts/delivery/${id}/`, data);
  }

  // ── Payout Lifecycle — Vendor ────────────────────────────────────────────
  approvePayout(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/vendors/payouts/${id}/approve/`, {});
  }

  declinePayout(id: string, reason: string = ''): Observable<any> {
    return this.http.post(`${this.baseUrl}/vendors/payouts/${id}/decline/`, { reason });
  }

  verifyPayoutCredit(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/vendors/payouts/${id}/verify-credit/`, {});
  }

  // ── Payout Lifecycle — Admin (vendor) ────────────────────────────────────
  scheduleAdminVendorPayout(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/payouts/vendors/${id}/schedule/`, {});
  }

  sendAdminVendorPayment(id: string, transactionRef?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/payouts/vendors/${id}/send-payment/`, { transaction_ref: transactionRef || '' });
  }

  forceAdminVendorPayoutPaid(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/payouts/vendors/${id}/force-paid/`, {});
  }

  // ── Payout Lifecycle — Admin (delivery) ──────────────────────────────────
  scheduleAdminDeliveryPayout(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/payouts/delivery/${id}/schedule/`, {});
  }

  sendAdminDeliveryPayment(id: string, transactionRef?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/payouts/delivery/${id}/send-payment/`, { transaction_ref: transactionRef || '' });
  }

  forceAdminDeliveryPayoutPaid(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/payouts/delivery/${id}/force-paid/`, {});
  }

  // ── Payout Lifecycle — Delivery Partner (self) ───────────────────────────
  getDeliveryPartnerPayouts(): Observable<any> {
    return this.http.get(`${this.baseUrl}/delivery/payouts/`);
  }

  approveDeliveryPayout(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/delivery/payouts/${id}/approve/`, {});
  }

  declineDeliveryPayout(id: string, reason: string = ''): Observable<any> {
    return this.http.post(`${this.baseUrl}/delivery/payouts/${id}/decline/`, { reason });
  }

  verifyDeliveryPayoutCredit(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/delivery/payouts/${id}/verify-credit/`, {});
  }

  // Scheduled Tasks
  getScheduledTasks(): Observable<any> {
    return this.http.get(`${this.baseUrl}/admin/scheduled-tasks/`);
  }

  createScheduledTask(data: { task_key: string; scheduled_time?: string; repeat?: number; kwargs: Record<string, any> }): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/scheduled-tasks/`, data);
  }

  cancelScheduledTask(jobId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/admin/scheduled-tasks/${jobId}/`);
  }

  // Wishlist
  getWishlist(): Observable<any> {
    return this.http.get(`${this.baseUrl}/products/wishlist/`);
  }

  toggleWishlist(productId: string): Observable<{ wishlisted: boolean }> {
    return this.http.post<{ wishlisted: boolean }>(`${this.baseUrl}/products/wishlist/${productId}/toggle/`, {});
  }

  getWishlistStatus(ids: string[]): Observable<Record<string, boolean>> {
    return this.http.get<Record<string, boolean>>(`${this.baseUrl}/products/wishlist/status/`, {
      params: { ids: ids.join(',') }
    });
  }

  getLoyaltyPreview(orderTotal: number): Observable<{ points: number; max_redeemable: number; discount: number }> {
    return this.http.get<any>(`${this.baseUrl}/auth/loyalty/preview/`, { params: { order_total: orderTotal.toString() } });
  }

  // Tip
  tipDeliveryPartner(orderId: string, amount: number): Observable<{ delivery_tip: string }> {
    return this.http.post<{ delivery_tip: string }>(`${this.baseUrl}/orders/${orderId}/tip/`, { amount });
  }

  // Referral
  getReferral(): Observable<any> {
    return this.http.get(`${this.baseUrl}/auth/referral/`);
  }

  applyReferralCode(code: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/referral/apply/`, { code });
  }

  lookupReferralCode(code: string): Observable<{ valid: boolean; code: string }> {
    return this.http.get<any>(`${this.baseUrl}/auth/referral/lookup/`, { params: { code } });
  }
}






