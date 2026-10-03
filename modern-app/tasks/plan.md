# Implementation Plan: External Goods Import

## Overview
Add an external-goods import workflow with multi-currency purchase and landed costs. Saving an import creates a draft and supplier payable metadata without posting stock. Receiving is the only operation that posts stock and applies the final base-currency unit cost using the stored exchange rates and allocated additional costs.

## Architecture Decisions
- Extend the customer POS schema with dedicated import tables rather than overloading local purchase invoices.
- Store every monetary input with its source currency and exchange rate to the branch base currency; persist converted base amounts for auditability.
- Keep import drafts out of `StockMovements`; create stock movements and accounting entries only in the receive transaction.
- Reuse existing item, partner, currency, transaction, and shared UI components.

## Task List

### Phase 1: Contract and persistence
- [ ] Add versioned import schema and models for headers, lines, and additional costs.
- [ ] Add backend endpoints for list, create/update draft, add costs, and receive.

### Checkpoint: Persistence
- [ ] Migration applies to the existing POS database only.
- [ ] Draft creation creates no stock movement.
- [ ] Receive creates stock movements with final base-currency costs.

### Phase 2: UI workflow
- [ ] Add Import shipment page and route/tab from Purchases.
- [ ] Implement supplier, currency, item, and multi-currency cost editing with save draft and receive actions.
- [ ] Show clear status and summary explaining that stock changes only on receipt.

### Checkpoint: End to end
- [ ] A draft can be saved, reopened, costs added, and received.
- [ ] Existing purchases, inventory, and builds remain healthy.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Exchange-rate ambiguity | Wrong landed cost | Store source currency, explicit rate-to-base, and converted amount per line/cost. |
| Draft accidentally affects stock | Inventory corruption | No stock insert in draft paths; receive endpoint is the only posting path. |
| Existing inventory queries omit imports | Missing stock/batches | Extend inventory queries to include received import lines through a shared stock source. |

## Open Questions
- Whether the accounting chart should use a dedicated goods-in-transit account; initial implementation will use the existing inventory/AP accounts on receipt and keep draft payable metadata separate until payment integration is wired.
