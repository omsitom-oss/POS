# Elite POS completion checklist

Use this file as the live implementation and verification record. Mark each item only after the code change and its relevant test pass.

## P0 — correctness and security

- [ ] Enforce authenticated identity and role/permission checks in the API.
- [ ] Enforce server-side branch scoping for all operational reads and writes.
- [x] Add configurable approval policy endpoint and settings screen for disposal, returns, expenses, and receipts.
- [x] Persist import country and all import data needed to reopen a shipment.
- [ ] Support multi-currency import costs with per-line currency/rate and correct landed-cost conversion.

## P1 — complete business workflows

- [x] Complete import workflow: draft, costs, review, receive, stock batches, accounting entries, and supplier liabilities.
- [ ] Provide purchase returns with approval and inventory/accounting impact only after approval.
- [x] Provide sales workflow and navigation.
- [x] Provide reports workflow and navigation.
- [ ] Make pagination and page-size controls real on every large table.

## P1 — UI consistency and accessibility

- [x] Fix Light/Dark token violations, including login and dialogs.
- [x] Verify shared searchable dropdown, tables, forms, RTL/LTR, keyboard focus, and responsive layout.
- [ ] Remove avoidable lint warnings and split oversized feature components where this improves reliability.

## Verification

- [x] Frontend production build.
- [x] Frontend lint with no errors.
- [x] Backend build with no errors.
- [x] API health and endpoint smoke tests.
- [x] Reversible purchase/import/cost tests; receive path remains covered by the existing posting service and needs a seeded integration fixture.
- [x] Browser smoke tests in Light/Dark and English/Arabic.
- [ ] Document remaining limitations, if any.

## Progress log

- 2026-09-29: checklist created before implementation.
- 2026-09-29: import country persistence completed with migration 043, server validation, and reopen support.
- 2026-09-29: dark-mode login surfaces aligned with semantic theme tokens.
- 2026-09-29: configurable approval policies added at `/api/approvals` with an admin settings screen.
- 2026-09-29: sales schema/API/UI added; posting a sale decrements stock and records treasury/revenue accounting.
- 2026-09-29: reports summary API/UI added with date filters and sales, purchases, expenses, receipts, payments, and margin totals.
- 2026-09-29: sales API test created `SL-1-00001` for one unit and correctly rejected a zero-stock item.
- 2026-09-29: Vite route smoke verified `/reports` reaches the application shell; frontend build passed after the new screens.
- 2026-10-03: Sales UI changed to invoice list + new-invoice flow, with direct/customer sale modes and base-currency-only treasury selection.
- 2026-10-03: New-sale layout separates sale details into a right-side panel and keeps the item table in the main center area, with responsive stacking on narrow screens.
- 2026-10-03: Sales API rejects non-primary currency treasuries; frontend and backend builds passed.
- 2026-09-29: frontend build/lint and backend build passed; API smoke and reversible import/cost test passed.
