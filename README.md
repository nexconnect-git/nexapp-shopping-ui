# NexConnect Frontend

Angular 19 monorepo with four standalone applications for the NexConnect multi-vendor delivery platform.

## Tech Stack

| | |
|---|---|
| Framework | Angular 19 (standalone components, no NgModules) |
| State | Angular Signals (`signal()`, `computed()`) |
| HTTP | `HttpClient` + auth interceptor |
| Auth | JWT stored in `localStorage`, injected via `AuthInterceptor` |
| Styling | SCSS with CSS custom properties (design tokens) |
| Build | Angular CLI workspace — each app builds independently |

## Workspace Structure

```
frontend/
├── projects/
│   ├── shared/                  # Shared library — imported by all apps
│   │   └── src/lib/
│   │       ├── models/index.ts  # TypeScript interfaces
│   │       ├── services/
│   │       │   ├── api.service.ts
│   │       │   └── auth.service.ts
│   │       ├── interceptors/auth.interceptor.ts
│   │       └── guards/auth.guard.ts
│   │
│   ├── customer-app/            # Shopper-facing PWA
│   ├── vendor-app/              # Vendor store management
│   ├── delivery-app/            # Delivery partner mobile UI
│   └── admin-panel/             # Platform administration dashboard
├── angular.json
├── package.json
└── tsconfig.json
```

## Applications

### customer-app
Shopping experience for end customers.

| Route | Component | Notes |
|---|---|---|
| `/` | `HomeComponent` | Hero, featured products, featured vendors |
| `/shops` | `ShopsComponent` | Vendor list with search, city, open-only filters |
| `/shops/:id` | `ShopDetailComponent` | Vendor info + product grid |
| `/products` | `ProductsComponent` | Browse all products — sidebar filters (category, price, stock), sort |
| `/products/:id` | `ProductDetailComponent` | Image gallery, add-to-cart, reviews |
| `/cart` | `CartComponent` | Qty update, remove, address picker, place order |
| `/orders` | `OrdersComponent` | Order history with status tabs |
| `/orders/:id` | `OrderDetailComponent` | Items, pricing, tracking timeline, cancel |
| `/profile` | `ProfileComponent` | Edit user account |
| `/addresses` | `AddressesComponent` | Manage delivery addresses |
| `/login` | `LoginComponent` | Validates `role=customer` |
| `/register` | `RegisterComponent` | Flat form, sends `role: customer` |

**App shell features:**
- Sticky header with nav links
- Cart icon badge (live count via `api.cartCount` signal, refreshed on navigation and after add-to-cart)
- Notification bell badge (live unread count via `api.unreadNotifications`, marks all read on click)
- User dropdown with profile/orders/addresses/logout
- Responsive mobile hamburger menu

---

### vendor-app
Store management for approved vendors.

| Route | Component | Notes |
|---|---|---|
| `/` | `DashboardComponent` | Stats cards, recent orders table |
| `/products` | `ProductsComponent` | Product table with delete |
| `/products/new` | `ProductFormComponent` | Create product — loads categories |
| `/products/:id/edit` | `ProductFormComponent` | Edit product (same component) |
| `/orders` | `OrdersComponent` | Order list with inline status updates |
| `/orders/:id` | `OrderDetailComponent` | Detail + confirm/prepare/ready buttons |
| `/profile` | `ProfileComponent` | Edit account + store info (two separate API calls) |
| `/login` | `LoginComponent` | Validates `role=vendor` |
| `/register` | `RegisterComponent` | 3-step wizard: personal → store → location |

---

### delivery-app
Mobile-first UI for delivery partners.

| Route | Component | Notes |
|---|---|---|
| `/` | `DashboardComponent` | Stats, availability toggle, active orders |
| `/available` | `AvailableOrdersComponent` | `ready` orders — accept button |
| `/active` | `ActiveDeliveryComponent` | Status progression: picked_up → on_the_way → delivered |
| `/history` | `HistoryComponent` | Completed deliveries list |
| `/earnings` | `EarningsComponent` | Total/monthly earnings, per-delivery table |
| `/profile` | `ProfileComponent` | Edit account details |
| `/login` | `LoginComponent` | Validates `role=delivery` |
| `/register` | `RegisterComponent` | 2-step: personal info → vehicle info (single API call) |

---

### admin-panel
Dark-theme admin dashboard.

| Route | Component | Notes |
|---|---|---|
| `/` | `DashboardComponent` | 8 live stat cards + recent orders + top vendors |
| `/vendors` | `VendorsComponent` | All vendors — search, status filter, approve/suspend/restore |
| `/customers` | `CustomersComponent` | Customer list — search, verified filter, delete |
| `/delivery-partners` | `DeliveryPartnersComponent` | Delivery partners — search, approval filter, approve/revoke |
| `/orders` | `OrdersComponent` | All platform orders — status filter, pagination |
| `/products` | `ProductsComponent` | All products across vendors — search, pagination |
| `/categories` | `CategoriesComponent` | Category grid with active status |
| `/login` | `LoginComponent` | Validates `role=admin` |

---

## Shared Library (`@shared/public-api`)

Imported in all apps as `@shared/public-api`.

### Models (`models/index.ts`)

```typescript
User          // id, username, email, role, phone, avatar, is_verified
AuthResponse  // { user: User, tokens: { access, refresh } }
Address       // label, full_name, phone, address fields, lat/lng, is_default
Vendor        // store_name, logo, banner, contact, location, hours, status, ratings
Category      // name, slug, is_active, children
Product       // name, price, stock, images, category, vendor, ratings
CartItem      // product, quantity, subtotal
Cart          // items[], total_items, total_amount
Order         // order_number, status, pricing, items[], tracking[], delivery_address
OrderTracking // status, description, lat/lng, timestamp
DeliveryPartner // vehicle info, is_approved, status, location, earnings
Notification  // title, message, notification_type, is_read, data
PaginatedResponse<T> // count, next, previous, results: T[]
DashboardStats       // total_orders, total_products, average_rating, recent_orders
DeliveryDashboard    // total_deliveries, total_earnings, active_orders
```

### ApiService

All HTTP calls go through `ApiService`. Base URL: `http://localhost:8000/api`.

**Reactive state (signals):**

| Signal | Updated by |
|---|---|
| `cartCount` | `refreshCartCount()` — called on navigation, after add-to-cart, after place-order |
| `unreadNotifications` | `refreshUnreadCount()` — called on navigation, cleared on notification click |

**Method groups:**

| Group | Methods |
|---|---|
| Auth | `login()`, `register()`, `getProfile()`, `updateProfile()` |
| Addresses | `getAddresses()`, `createAddress()`, `updateAddress()`, `deleteAddress()` |
| Vendors | `getVendors()`, `getNearbyVendors()`, `getVendor()`, `registerVendor()`, `getVendorDashboard()`, `getVendorProfile()`, `updateVendorProfile()` |
| Vendor orders | `getVendorOrders()`, `updateOrderStatus()` |
| Vendor products | `getVendorProducts()`, `createProduct()`, `updateProduct()`, `deleteProduct()` |
| Products | `getCategories()`, `getProducts()`, `getProduct()`, `getFeaturedProducts()` |
| Cart | `getCart()`, `addToCart()`, `updateCartItem()`, `removeCartItem()`, `clearCart()` |
| Orders | `createOrder()`, `getOrders()`, `getOrder()`, `cancelOrder()`, `getOrderTracking()` |
| Delivery | `registerDeliveryPartner()`, `getDeliveryDashboard()`, `getAvailableOrders()`, `acceptDelivery()`, `updateDeliveryStatus()`, `updateLocation()`, `getDeliveryHistory()`, `getDeliveryEarnings()` |
| Notifications | `getNotifications()`, `markNotificationRead()`, `markAllNotificationsRead()`, `getUnreadCount()` |
| Reviews | `getVendorReviews()`, `createVendorReview()`, `getProductReviews()`, `createProductReview()` |
| Admin | `getAdminStats()`, `getAdminCustomers()`, `getAdminCustomer()`, `updateAdminCustomer()`, `deleteAdminCustomer()`, `getAdminVendors()`, `setVendorStatus()`, `getAdminDeliveryPartners()`, `getAdminDeliveryPartner()`, `approveDeliveryPartner()` |

### AuthService

Wraps auth state using Angular Signals.

```typescript
currentUser   // signal<User | null>
isLoggedIn    // computed(() => !!currentUser())
user()        // alias for currentUser()

login(username, password)
register(data)
handleAuthResponse(response)  // stores tokens + user in localStorage
updateUserData(user)          // updates signal + localStorage
logout()                      // clears everything
```

### AuthInterceptor

Automatically attaches `Authorization: Bearer <token>` to every outgoing HTTP request when a token is in `localStorage`.

### AuthGuard

Route guard — redirects to `/login` if not authenticated.

---

## Running Locally

```bash
cd frontend
npm install
```

Run a specific app:

```bash
npx ng serve customer-app   # http://localhost:4200
npx ng serve vendor-app     # http://localhost:4201
npx ng serve delivery-app   # http://localhost:4202
npx ng serve admin-panel    # http://localhost:4203
```

Ensure the backend is running at `http://localhost:8000` before starting any app.

Build for production:

```bash
npx ng build customer-app --configuration production
npx ng build vendor-app --configuration production
npx ng build delivery-app --configuration production
npx ng build admin-panel --configuration production
```

---

## Design System

### customer-app / vendor-app

Light theme using CSS custom properties defined in `styles.scss`:

```scss
--primary:        #6C63FF   // Purple
--primary-dark:   #4A3FCC
--secondary:      #FF6584   // Pink/red accent
--text:           #1A1A2E
--text-secondary: #6B7280
--card:           #FFFFFF
--border:         #E5E7EB
--radius:         12px
--header-height:  64px
```

Key utility classes: `.btn`, `.btn-primary`, `.btn-ghost`, `.card`, `.badge`, `.badge-*status*`, `.form-input`, `.container`, `.page-padding`

### delivery-app

Light green theme — accent `#00C853` (Material Green A700).

### admin-panel

Dark theme:

```
Background:  #0F0F1A (deepest) / #1A1A2E (cards)
Border:      rgba(15, 52, 96, 0.3)
Accent red:  #E94560
Accent cyan: #06B6D4
Text:        #E0E0E0 / #CCD6F6 / #8892B0 (muted)
```

---

## Key Patterns

### Signals for local state
```typescript
loading = signal(true);
items = signal<Product[]>([]);
page = signal(1);
```

### Debounced search
```typescript
private timer: any;
onSearch() {
  clearTimeout(this.timer);
  this.timer = setTimeout(() => { this.page.set(1); this.load(); }, 400);
}
```

### Paginated API response
```typescript
this.api.getSomething(params).subscribe({
  next: (r) => {
    this.items.set(r.results || r);   // handles paginated and plain array responses
    this.total.set(r.count || r.length);
    this.totalPages.set(Math.ceil((r.count || 0) / 20) || 1);
  }
});
```

### Role validation on login
```typescript
// Each app's LoginComponent rejects users with the wrong role
if (res.user.role !== 'vendor') {
  this.auth.logout();
  this.error.set('This portal is for vendors only.');
  return;
}
```
