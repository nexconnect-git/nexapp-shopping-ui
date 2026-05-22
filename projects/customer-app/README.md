# FlashDrop Angular Instamart-style Web App

Production-style Angular mock implementation matching the first Swiggy Instamart-inspired FlashDrop dashboard mockup, with full app pages and in-memory logic.

## Includes

- App shell: sticky header, left category navigation, desktop rails
- Home dashboard
- All stores page
- Category/product listing page
- Store detail page with grouped product sections
- Product detail page
- Global search results
- Cart with quantity controls, coupon and totals
- Checkout with address, delivery slot, payment method logic
- Orders history
- Live order tracking
- Profile dashboard
- Addresses CRUD modal
- Offers/coupons
- Wallet with transactions
- Wishlist
- Referral
- Location selection
- Issues/help
- Auth screens: login, register, forgot password, reset password
- Services:
  - CatalogService
  - AppStateService
  - AuthService
  - OrderService
  - authInterceptor
- Assets:
  - Generated mockups are stored in `src/assets/mockups`
  - Product/store images use remote Unsplash URLs for realistic UI

## Run

```bash
npm install
npm start
```

## Build

```bash
npm run build
```

## Notes

This is a front-end implementation with in-memory mock services. Replace the service methods with API calls when connecting to your backend.

## V3 UX Enhancements

Added requested interaction upgrades:

- Login slider drawer instead of conventional full login page trigger
- Mini cart drawer
- Live search dropdown with stores/products updating while typing
- Breadcrumb component and breadcrumbs on major pages
- Home page rotating promotional banner container
- Edit modal for profile/address/payment style forms
- Toast messages for add-to-cart, coupon, login, save actions
- Animations for cards, drawer, modal, and toast

## V4 Fixes

- Fixed login page/shell clipping issue by hiding header/sidebar on auth routes.
- Header location now opens a modal instead of navigating away.
- Header More menu now opens a functional dropdown.
- Header user/avatar menu now opens a functional account dropdown.
- Cart icon opens a mini cart drawer.
- Added filter slider drawer and wired it to stores/search/store-detail.
- Added in-store search on store detail pages.
- Live search remains active in the header and search page.

## V5 Updates

Requested changes implemented:

- Address/location modal now shows full address details for saved addresses and popular areas.
- Filter slider design has been reworked with clean sections, sticky footer, safer spacing, categories, range bar and better button alignment.
- `/location` route removed; location selection is modal-only.
- Standalone login/register/forgot/reset routes removed.
- Login is now only a slider/drawer OTP flow from the header user menu.
- Header More and User navigation remain dropdown-driven.
- Added/expanded modular shared UI components:
  - `shared/ui/nx-button.component.ts`
  - `shared/ui/nx-card.component.ts`
  - `shared/ui/nx-input.component.ts`
  - `shared/ui/nx-modal-shell.component.ts`
- Existing domain modules remain separated into services, shared shell components, reusable cards, and page components.

## V6 Fix

- Fixed the screen blur issue when opening the Header More/User dropdown.
- The dropdown click-outside backdrop now stays transparent and uses `backdrop-filter: none`.
- Search overlay still keeps its intentional subtle blur.

## V7 Fix

- Fixed profile/user dropdown links not working.
- The transparent click-outside backdrop no longer sits above the dropdown.
- Header, dropdown wrapper, and dropdown items now have correct z-index layering.
- Profile dropdown links route correctly to Profile, Addresses, Wishlist, Wallet.
- Login/Switch account opens the OTP slider.

## V8 Fix

- Fixed login slider style issue shown after opening Login/Switch account.
- Login drawer now starts below the sticky header instead of colliding with it.
- Removed excessive backdrop blur from the login overlay.
- Added safer drawer spacing, rounded panel styling, and scroll-safe layout.
- Header remains visible while login drawer is open.

## V9 Update

- Added a completed/finished order page at `/order-finished/:id`.
- Delivered orders in the orders list now open the finished order page.
- Finished order page includes:
  - Delivered success summary
  - Completed timeline
  - Items delivered
  - Delivery partner summary
  - Bill summary
  - Rating/review form
  - Reorder, invoice, help, coupon actions

## V10 Fix

- Fixed filter drawer visual issue.
- Removed heavy blur from the page behind the filter slider.
- Filter drawer now starts below the sticky header instead of hiding under it.
- Header remains visible and usable while the filter panel is open.
- Backdrop is now a light dim only, with `backdrop-filter: none`.

## V11 Angular Folder Structure

The project has been reorganized into a more Angular-friendly component structure.

### What changed

- Inline Angular templates were moved into `.component.html` files.
- Inline styles were moved into `.component.scss` files.
- Each page is now in its own folder under `src/app/pages`.
- Each reusable UI component is now in its own folder under `src/app/components` or `src/app/shared`.
- Shared UI primitives are under `src/app/shared/ui`.
- Routes were updated to point to the new folder-based page components.
- Imports were updated for the new folder structure.

### Example structure

```txt
src/app/
  app.component.ts
  app.component.html
  app.component.scss

  pages/
    home/
      home.component.ts
      home.component.html
      home.component.scss
    stores/
      stores.component.ts
      stores.component.html
      stores.component.scss

  components/
    product-card/
      product-card.component.ts
      product-card.component.html
      product-card.component.scss
    store-card/
      store-card.component.ts
      store-card.component.html
      store-card.component.scss

  shared/
    topbar/
      topbar.component.ts
      topbar.component.html
      topbar.component.scss
    login-slider/
      login-slider.component.ts
      login-slider.component.html
      login-slider.component.scss
    ui/
      nx-button/
        nx-button.component.ts
        nx-button.component.html
        nx-button.component.scss
```
