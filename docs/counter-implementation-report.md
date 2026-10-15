# Counter vendor UI replacement — implementation and verification

Recorded 8 October 2026. The 25 primary vendor routes and shared shell have been converted. **Acceptance remains incomplete:** new-credential workflows, permanent deletion, download completion and some negative states have not been verified. This report distinguishes implemented behavior, actual browser observations and remaining checks.

## A. Counter foundation

The supplied `Nextou_Counter_Prototype.html` supplied the visual structure and design tokens. After local-file browser access was blocked, the user approved direct HTML/CSS inspection. There was no rendered, side-by-side prototype comparison; pixel equivalence is not claimed.

The active vendor sidebar and its 1,036-line workspace stylesheet were removed. The shell now uses the Counter masthead, Today / Orders / Catalog / Money / Growth / Store navigation, contextual operating controls, inbox preview, account dialog and permission-filtered Explore destinations. The phone dock provides Home, Orders, Inventory, Inbox and More.

`_counter-reference.scss` contains the reference visual rules; `counter-controls.scss` supplies vendor control styles. The Counter palette uses purple `#5740cf`, paper `#f5f4ee`, off-white `#fffefa`, ink and lime accents, serif headings and Inter body text. PrimeNG uses a vendor-only preset and only the Aura base, button and dialog tokens. Existing package dependencies were sufficient; no dependency or lockfile change was made.

The reusable `WorkspaceDialogComponent` supplies modal/dialog and drawer presentations through PrimeNG, including focus trapping, Escape, pending-action dismissal guards and focus restoration. Phone drawers become full-height sheets. `CounterStateComponent` supplies loading, empty, stale and error surfaces. Shell dialogs are deferred until opened. Routes remain lazy loaded.

Page compositions were replaced with compact rows, operational lanes, focused action areas, four-step product creation, four product-edit tabs, sales/settlement analytics tabs and six settings sections. Phone lists stack into readable rows/cards. Runtime business data still comes from the existing services and backend; prototype records, timers and business JavaScript were not imported.

## B. Route conversion and browser coverage

Every row below was converted. D/T/P means an actual browser visit and captured presentation at **1440×900, 834×1112 and 390×844**. It does not mean every state or action was tested at each size. The complete 173-state design mapping is in [counter-migration.md](counter-migration.md); that mapping is not a claim of 173 executed tests.

| Route | Prototype | Real state/API retained | Browser evidence | Remaining verification |
| --- | --- | --- | --- | --- |
| Shared shell | S00 | Context, inbox, startup, leave guard, auth and feature access | D/T/P; Explore, operating drawer, close confirmation, dirty guard, account and inbox | Exhaustive keyboard sequences on every overlay |
| `/` | P01 | Vendor context and dashboard summary | D/T/P; actual scoped totals and stock/operating readiness | Independent summary-only failure |
| `/live-orders` | P02 | Orders store and order actions | D/T/P; live placement, transitions, stage filters, outage/reconnect | Rejection, timed-out search and conflicting order command |
| `/orders` | P03 | Workspace API and orders store | D/T/P; search/filter/history, delivered outcome | Every date/status combination and history-only failure |
| `/orders/:id` | P04 | Order facade/store, tracking and maps | D/T/P; Details, Delivery, Activity, OTP, delivered terminal state; other-owner 404 | Cancel-with-reason, invoice download completion, deliberate map-provider failure |
| `/orders/:id/prep` | P05 | Orders store and local advisory checklist | D/T/P; checklist reload and mark-ready | Cancellation arriving during preparation |
| `/inventory` | P06 | Workspace API, vendor API and context | D/T/P; cross-page changes, bulk partial success, conflict acknowledgment/retry, dirty guard, outage, stock review | Every numeric-boundary/filter combination |
| `/products` | P07 | Workspace API and context | D/T/P; paging, filters, visibility drawer, persisted approval states | Permanent/protected deletion outcome |
| `/products/new` | P08 | Single product-create service | D/T/P; four steps, persisted drafts, upload, duplicate same-item variant, two-variant submission/reload | Deliberate per-variant submission/upload failures and retry |
| `/products/:id/edit` | P09 | Single product-edit service | D/T/P; all four tabs, upload, saved stock, pending identity locks; other-owner 404 | Permanent image removal and every cross-tab error |
| `/catalog-requests` | P10 | Existing proposal API | D/T/P; validation, two-item request, mixed result drawer, exact granted-item follow-up | Filter combinations and request-only failure |
| `/analytics` | P11 | Independent sales and finance reads | D/T/P; 7/30/90/all, chart/table and settlement tab | Finance-only failure and completed CSV download |
| `/payouts` | P12 | Payout API, aggregates and context | D/T/P; inspect, approve, decline with reason, confirm receipt; persisted states | Conflict response and completed statement download |
| `/transactions` | P13 | Ledger API and authoritative balance | D/T/P; returned ledger, search/filter | All date/type/paging combinations |
| `/promotions` | P14 | Coupon API and timezone conversion | D/T/P; create, edit, duplicate, reactivate, schedule persistence; delete dialog canceled | Permanent delete awaiting action-time confirmation |
| `/reviews` | P15 | Review API and aggregates | D/T/P; empty and populated states, distribution and low-rating filter | Long-text expansion and multi-page review dataset |
| `/notifications` | P16 | One shared inbox service | D/T/P; mark one/all, shell/page counts and entity navigation | Failed mark-read and every category/page |
| `/support` | P17 | Ticket/request and stored-response API | D/T/P; validation, create, reload/history/detail and stored response | Ticket-only failure and every status/page |
| `/store-settings` | P18 | Single settings service; separate account/operating endpoints | D/T/P; all six sections, account/store saves, zero coordinates, overnight hours | Geolocation denial, logo/banner upload and independent partial-save failure |
| `/login` | P19 | Auth and vendor profile/security check | D/T/P; approved, pending and forced accounts, reload/logout, invalid-field focus | Rejected credentials, profile-only failure, long username and return-URL variants |
| `/register` | P20 | Existing registration and identity API | D/T/P; account step and first-invalid-field focus | Store/Location/Review browser advancement and final account creation require new-credential handoff |
| `/change-password` | P21 | Workspace API, auth and context | D/T/P; voluntary/forced modes, protected-route redirect | New credential and success path require user entry/submission |
| `/forgot-password` | P22 | Existing recovery endpoint | D/T/P; validation focus, real privacy-safe 200 response | External email delivery is not tested |
| `/reset-password` | P23 | Token-based reset endpoint | D/T/P; missing-token state and nonvalid-token form layout | Invalid-token submission, password validation and reset success require credential handoff |
| `/pending-approval` | P24 | Existing onboarding API and session state | D/T/P; correction save, document upload/reload, contact, rejected/suspended and route restriction | Upload failure and automatic approval transition |
| `/feature-unavailable` | U01 | Approval/feature guards and authoritative feature metadata | D/T/P; disabled deep link and filtered navigation | Every forbidden/session/bootstrap failure combination |

Compatibility aliases remain in `app.routes.ts`: `/products/health`, `/products/edit/:id`, `/order/:id`, `/order/:id/tracking`, `/profile`, `/sales-report`, `/stock-management`, `/wallet`, `/payments`, `/coupons`, `/store/settings`. Their source mappings were retained; a separate browser execution of every alias is not claimed.

## C. Existing business behavior retained

No backend runtime file, shared library runtime file or other portal UI was changed. Existing typed clients, signals, session services, ownership rules, permissions, allowed actions, state versions and generation/session checks remain the behavior owners.

- Auth/profile checks still precede approved operations. Pending vendors and required password updates remain restricted. Feature flags govern navigation and deep links. Other-vendor product/order IDs returned 404 without exposing records or actions.
- Store enablement, current effective availability and intake remain distinct. Opening blockers come from context; acknowledging stock review uses the existing inventory-review endpoint. Close/open and pause/resume are separate commands.
- Accept, start preparing, mark ready, search, cancel search and verify pickup remain separate server actions. Marking ready did not start a search. Events reconcile through the existing order store; delivery GPS and connection indicators retain their existing owners.
- Inventory saves carry expected quantities. A bulk 200 can contain both successful IDs and row errors; failed drafts remain editable. Current quantities must be acknowledged before retry. Page changes do not discard dirty rows.
- Product approval, availability, stock and customer visibility are displayed separately. Creation retains persisted product identities before uploads, per-variant save/submission state and existing retry protections. Edit tabs share one state owner and respect approval locks.
- Payout approval, decline and recipient credit acknowledgment keep their existing meanings. No transfer or bank verification was added. Ledger data remains read-only; current balance is supplied by the API.
- Inbox preview and page share one unread source. Support remains a request plus stored platform response. Reviews remain read-only. No chat or seller reply was invented.
- Settings retain separate account/store/operating writes, nullable and zero coordinates, configured timezone and overnight hours. Read-only administrative values remain read-only.

The product-create service received only step-navigation changes to introduce Fulfillment between Variants and Review, restart Fulfillment at the first variant and focus the first newly resumed draft. Login, recovery, registration and settings gained first-invalid-field focus behavior. Registration coordinate inputs now expose their shared validation error through ARIA, so first-invalid-field focus can reach them. This Location-step change has only build/lint verification pending user registration handoff. Domain APIs and backend transition rules were not replaced.

## D. Actual browser verification

### Environment and evidence

The application was exercised at `http://127.0.0.1:4201` against the real Django API in a separate local QA stack: backend port 8011, dedicated Redis/RQ/Channels, `output/counter-qa.sqlite3` and local media. This is not production. QA fixtures supplied records and account states; they were not inserted into Angular runtime source. Driver transitions and catalog review were performed through existing backend actions/API as secondary fixture steps, not through the driver/admin portal UI. Email used local memory storage; no external bank transfer or email delivery occurred.

Evidence directory: [output/counter-qa](../../output/counter-qa/). As of the report snapshot it contains **249 screenshots**, **189 main-viewport records**, **125 additional-width records**, **683 valid API records** and **69 successful write responses**, including fixture API requests and auth/session calls. These are activity counts, not unique passing-test counts.

All 25 route paths were additionally checked at widths **360, 768, 1024, 1366 and 1920**. There was no document overflow in the recorded main-viewport or additional-width checks. This does not establish that every nested control, scroll position or state is free of clipping. Earlier exploratory screenshots can contain loading or scrolled views; prefer the explicitly named `*-verified-*` evidence and the two-variant wizard captures.

The API log contains **49 unreadable lines** from concurrent earlier writes; they were preserved. Later logging uses file locking. Request bodies are absent from many earlier records because the evidence middleware read the consumed request stream; credentials/OTP/auth bodies are intentionally excluded or redacted. Therefore this is **not a complete request-payload trace**. Method, path, response status and valid response bodies still provide supporting evidence. Screenshots and DOM captures show visible outcomes independently.

### Observed workflows and persisted results

| Workflow | Actual action / response | Observed result and persistence |
| --- | --- | --- |
| Order lifecycle `52928275-0f0a-4906-9987-aaf977bc925e` | Vendor accept/start-preparing/mark-ready/search: 200 each; wrong pickup OTP: 400; correct OTP: 200 | Placed → Confirmed → Preparing → Ready → Picked up. Checklist survived reload. Driver fixture acceptance/on-way/location/confirmation then produced Delivered, seven activity transitions, history entry and removal from active work. |
| Search cancellation/retry | Real RQ search → Notified; cancellation/retry used the existing order endpoints | A cancellation initially hit SQLite `database is locked` (500); the UI retained Ready and showed failure. Retry succeeded. A fresh search and cancellation then succeeded; final assignment is Cancelled, with Find driver available. |
| Live reconnect | Stopped/restarted only the QA backend | Five cached orders remained visible with “Reconnecting · refreshes every 30s”; connection recovered and reconciled. |
| Stock partial success | `POST /api/vendors/bulk-update-stock/` 200 returned one updated ID and one `current_stock:18` conflict | Successful row became 22; conflicted draft remained 21. Keep my quantity acknowledged server 18; retry saved 21 and reload retained it. |
| Stock review / opening | `POST /api/vendors/inventory/review/` 200 then store command 200 | Required review initially disabled opening/resume. Review acknowledgment cleared the blocker. Opening succeeded. Original QA operating flags were then restored. |
| Cached failure and dirty navigation | QA API stopped; Refresh and availability command attempted; local stock edit then Today navigation | Cached stock retained; failed availability write did not flip the listing. Dirty confirmation retained edits on Stay, and Discard restored the saved quantity. |
| Product drafts and variants | Actual draft-batch, draft PATCH, duplicate and submit endpoints | Draft reload/resume worked. Same catalog item has separate 2-pack ₹90/stock7 and 4-pack ₹110/stock4 records. Fulfillment processed both; both submitted and remained Pending Approval after Products reload. |
| Product media and operational edit | Real local PNG upload; pending product stock save | Uploaded media persisted on the saved product. Pending identity fields were locked; permitted stock change persisted as 14. |
| Catalog proposal | Real two-item submission; backend review fixture produced one approval/one rejection | History/detail showed Partially Approved and actual reason. Follow-up used the exact approved catalog ID; its product was uploaded and submitted. |
| Settlements | Approve, decline and verify-credit endpoints: 200 | Returned approved, failed-with-reason and verified states persisted. Verify-credit is recipient acknowledgment; no external bank action occurred. |
| Promotions | Create 201, edit 200, duplicate 201, reactivate 200 | `QA_COUNTER_10` changed 10% → 12%; copied coupon became active. UTC start/end persisted as 2026-10-07T10:30Z and 2026-10-09T11:45Z. Delete confirmation was canceled. |
| Support | `POST /api/support/tickets/` 201 | “Counter browser QA request” persisted in history and detail. A separately seeded resolved record displayed its stored response. |
| Inbox | Mark one 200, mark all 200 | Global unread changed 5 → 4 → 0 with agreement between shell and page. Entity navigation opened the actual order. |
| Reviews | Real review GET against two fixture reviews | Aggregate 3.5 across two reviews; distribution 5-star=1 and 2-star=1. Low-rating filter showed one row while retaining global aggregates. Empty presentation also captured. |
| Settings | Store PATCH 200 and account PUT 200 | Description, first name, coordinates 0/0 and 22:00→06:00 overnight hours survived reload; account and store payloads remained separate. |
| Access and onboarding | Actual approved/pending/forced login; correction PATCH 200, document upload 201, onboarding contact 201 | Corrected description, pending document and contact persisted. Suspended/rejected presentation matched actual fixture state. Forced account could not deep-link to Products. |
| Recovery | `POST /api/auth/password-reset/` 200 | Generic privacy-safe confirmation displayed. Empty email submit focused the invalid field. No external delivery is inferred. |

### Dialogs, focus and visual evidence

Operating, close-store, dirty navigation, Explore, product filters/blockers, catalog details, settlement decisions, promotion editor/delete confirmation and support surfaces were exercised. Representative dialog/drawer layouts were captured at all three main sizes. Shared modal keyboard behavior, Escape and focus restoration were checked during the migration; this is not an exhaustive focus-order audit of every overlay. Empty login, registration, recovery, catalog, coupon and support submissions were checked; the final login/register/recovery retest confirmed focus on the first invalid field. The active product wizard processes one focused step at a time, and settings process one selected section.

Representative evidence:

- [Today desktop](../../output/counter-qa/today-verified-desktop.jpg), [Today phone](../../output/counter-qa/today-verified-phone.jpg)
- [Live all stages](../../output/counter-qa/live-all-desktop.jpg), [reconnect outage](../../output/counter-qa/live-reconnect-outage.jpg), [recovered](../../output/counter-qa/live-reconnect-recovered.jpg)
- [Inventory phone](../../output/counter-qa/inventory-verified-phone.jpg), [dirty guard](../../output/counter-qa/dirty-guard-final-phone.jpg), [opening blocker](../../output/counter-qa/inventory-review-blocker-desktop.jpg)
- [Two-variant Fulfillment](../../output/counter-qa/create-fulfillment-two-variants-tablet.jpg), [Review](../../output/counter-qa/create-review-two-variants-phone.jpg), [persisted Products](../../output/counter-qa/products-verified-desktop.jpg)
- [Analytics](../../output/counter-qa/analytics-sales-verified-desktop.jpg), [settlements phone](../../output/counter-qa/payouts-verified-phone.jpg)
- [Settings](../../output/counter-qa/settings-pickup-verified-tablet.jpg), [restricted onboarding](../../output/counter-qa/onboarding-suspended-verified-phone.jpg), [credential handoff](../../output/counter-qa/credential-handoff.jpg)
- [Main geometry records](../../output/counter-qa/final-viewport-evidence.json), [additional widths](../../output/counter-qa/breakpoint-evidence.json), [API response evidence](../../output/counter-qa/api-evidence.jsonl), [console observations](../../output/counter-qa/browser-errors.json)

## E. Build and cross-portal checks

| Check | Actual result |
| --- | --- |
| Vendor production build, final 8 October 05:23 UTC | Passed; initial 686.86 kB, estimated transfer 173.77 kB. Advisory 650 kB budget exceeded by 36.86 kB; below 1 MB error limit. |
| Vendor lint, final 8 October | Passed: all files pass linting. |
| Frontend whitespace diff check | Passed with `git -c core.safecrlf=false diff --check`. |
| Customer production build during migration | Passed; initial 645.52 kB. |
| Delivery production build during migration | Passed; initial 618.70 kB. |
| Admin production build during migration | Passed; initial 732.22 kB, advisory budget warning and existing missing `D:/fonts/icons.css` warning. |

Other-portal and shared runtime source were not changed. Their production builds passed, but no complete customer/delivery/admin browser regression was performed. Cross-portal behavior is not fully certified by compilation. There was no backend deployment, migration, production data change, commit or push. Existing unrelated parent-worktree changes were left untouched.

## F. Remaining limitations and acceptance work

**Blocked verification / user handoff**

- Browser tooling requires the user to enter, confirm and submit new credentials. The existing `counter.forced.qa` account is signed in with its blank forced-update form ready. Password-change success, reset submission/success and registration advancement/final submission remain unverified. Do not enter the new password into chat or store it in this report.
- Permanent coupon deletion has a pending action-time confirmation. The dialog was prepared and canceled; no deletion success is claimed. Permanent product/image deletion likewise remains unverified.

**Environment / provider limitations**

- Prototype browser access was blocked; the user approved source inspection. No rendered prototype walkthrough or pixel comparison was completed.
- Statement GET returned 200, but the browser download-completion event timed out. Completed PDF/CSV/invoice downloads are unverified.
- SQLite write contention produced one real cancellation 500; subsequent retry and re-search/cancel succeeded. Production PostgreSQL concurrency was not tested.
- Maps rendered during live delivery, but permission denial, place-autocomplete failure and deliberate provider loss were not verified. No geolocation permission was accepted on the user's behalf.
- The QA log has unreadable earlier lines and missing earlier request bodies. It supports response/outcome verification but not full network-payload acceptance.
- Recorded console errors were stale Vite/HMR fetch failures while the development server was stopped before restoration. No new error records were observed after restoration during the recorded checks; that is not a guarantee of all-state console correctness.

**Unresolved implementation / test gaps**

- Vendor initial bundle remains 36.86 kB over the advisory budget. Only needed theme tokens and deferred dialogs reduced the earlier migration bundle, but the warning remains.
- The route table lists independent failure, conflicting-command, rejection/cancellation, media-delete, upload-failure and other state checks still outstanding. The atlas has 173 mapped states; they have not all been executed in the browser. The user's full definition of done is therefore not yet met.
- No separate failing runtime defect was identified in the exercised final flows. This statement does not clear the outstanding negative states or certify untested behavior.

**Separately scoped product capabilities**

Seller review replies, support chat, catalog proposal editing/resubmission, new weekly-hours APIs, targeting beyond the supported general coupons, forecasts and bank-transfer verification were not added. They require separate product/backend contracts.

The QA server and isolated database remain available for continuing the acceptance work and credential handoff. Do not treat the screenshots, passing build or route conversion count as final production approval.
