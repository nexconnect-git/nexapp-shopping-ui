import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = 'http://localhost:8000/api';

  readonly cartCount = signal(0);
  readonly unreadNotifications = signal(0);

  constructor(private http: HttpClient) {}

  refreshCartCount() {
    this.getCart().subscribe({
      next: (cart) => this.cartCount.set(cart.total_items || 0),
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
    return this.http.get(`${this.baseUrl}/vendors/dashboard/stats/`, { params: httpParams });
  }

  getVendorProfile(): Observable<any> {
    return this.http.get(`${this.baseUrl}/vendors/profile/`);
  }

  updateVendorProfile(data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/vendors/profile/`, data);
  }

  getVendorProducts(): Observable<any> {
    return this.http.get(`${this.baseUrl}/vendors/products/`);
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

  getVendorOrders(status?: string): Observable<any> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get(`${this.baseUrl}/vendors/orders/`, { params });
  }

  updateOrderStatus(orderId: string, status: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/vendors/orders/${orderId}/status/`, { status });
  }

  getVendorPayouts(): Observable<any> {
    return this.http.get(`${this.baseUrl}/vendors/payouts/`);
  }

  // Invoices
  getInvoices(): Observable<any> {
    return this.http.get(`${this.baseUrl}/invoices/`);
  }

  generateInvoice(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/invoices/generate/`, data);
  }

  downloadInvoiceUrl(invoiceId: string): string {
    return `${this.baseUrl}/invoices/${invoiceId}/download/`;
  }

  // Push Notifications (FCM)
  registerDeviceToken(data: { token: string; platform: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/notifications/device-token/`, data);
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
  createOrder(data: { delivery_address_id: string; notes?: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders/create/`, data);
  }

  getOrders(status?: string): Observable<any> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get(`${this.baseUrl}/orders/list/`, { params });
  }

  getOrder(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/orders/${id}/`);
  }

  cancelOrder(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders/${id}/cancel/`, {});
  }

  getOrderTracking(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/orders/${id}/tracking/`);
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

  getDeliveryHistory(): Observable<any> {
    return this.http.get(`${this.baseUrl}/delivery/history/`);
  }

  getDeliveryEarnings(): Observable<any> {
    return this.http.get(`${this.baseUrl}/delivery/earnings/`);
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
    return this.http.get(`${this.baseUrl}/admin/stats/`);
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
}


