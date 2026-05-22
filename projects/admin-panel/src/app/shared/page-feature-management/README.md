# Page & Feature Management Inventory

Every customer-facing or operations-facing page that is added to Vendor App, Delivery App, Customer App, or Mobile Customer must be added to `page-feature-management.seed.ts`.

When adding functionality inside an existing page, add it to that page's `features` list in the same seed file. Examples include new buttons, tabs, filters, exports, payment actions, status transitions, map actions, bulk actions, uploads, modals, or workflow steps.

`npm run build` runs `npm run validate:page-features` first. The validator fails when a new Angular route or mobile screen is missing from this inventory, so Page & Feature Management remains the source of truth for what admins can enable, disable, and audit.
