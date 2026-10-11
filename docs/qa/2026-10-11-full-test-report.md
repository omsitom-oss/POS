# Elite POS full test report (11 Oct 2026)

All testing ran on **POS_Test**. The real `POS` database was not touched.

## What was done

1. Pulled main (up to PR #27) and backed up POS_Test to
   `C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQL\Backup\POS_Test_pretest_20261011_2020.bak`.
2. Brought POS_Test from schema 50 to 56 (it was 6 updates behind main).
3. Ran every automated suite: backend 136 passed, SQL Server integration 63 passed (on throwaway databases),
   frontend 62 passed, lint and production build clean.
4. Cleared POS_Test transactions, then ran each business flow through the API and checked stock, batches
   and every ledger account after each step. Then checked each screen in the browser in English and Arabic.
5. Cleared POS_Test again at the end (see "Final state").

## Flows tested and result

| Flow | Result |
|---|---|
| Local purchase, draft then confirm | OK: draft moves nothing; confirm adds stock, Inventory Dr / Trade creditors Cr |
| Purchase in another unit (0.5 Ton = 500 kg) | OK |
| Walk-in cash sale | OK: stock taken from the batch that expires first, COGS posted at batch cost |
| Customer sale on account with discount | OK: customer balance goes up |
| Oversell, supplier on account, foreign till, zero-stock item | OK: all refused with clear messages |
| Sales return (cash and on account), over-return | OK |
| Purchase return with approval: pending, approve, reject | OK: stock moves only on approval |
| Receipt from customer, payment to supplier, payment from an empty bank | OK (empty bank refused) |
| Expense, treasury transfer SDG to SR, transfer above balance | OK |
| Disposal request then approve | API OK; **no screen could approve it** (fixed) |
| Import shipment in SR with accrued and till-paid costs, receive | OK: landed cost 11,000/kg, goods in transit cleared |
| Manual journal, unbalanced journal | OK |
| Delete draft purchase | OK |
| Cashier role: list price only, 5% discount cap, no purchases/users/receipts, other branch, spoofed SavedBy | OK |
| Inventory value vs ledger | OK: 1300 Inventory = sum of batch quantity x cost (8,973,000) |

## Bugs fixed (PR on branch `claude/full-qa-fixes`)

1. **Chart of accounts did not balance.** Trade debtors (1200) counted every line with a partner, so purchases
   were counted under both 1200 and 2100, and supplier payments showed under debtors. Each partner now nets to one
   balance shown under 1200 (owes us) or 2100 (we owe). New SQL Server test covers it.
2. **Error messages showed raw JSON** on 15 screens (sales, purchases, items, users, roles, currencies, branches,
   expenses, receipts, inventory, transfer, company profile, partners). They now show the message only; a 403 says
   "You do not have permission to do this." instead of a blank error.
3. **"Invoice saved" on Sales was shown in red** as an error. Now a success notice.
4. **Disposals could never be approved from the UI** and pending ones held stock back forever. Inventory now lists
   pending disposals with Approve / Reject (new reject endpoint, permission INVENTORY_APPROVE).
5. A negative sale quantity was reported as "Discount cannot exceed the sale total". Now reports the bad line.
6. `--migrate-pos` only accepted a database named `POS`, so POS_Test could not be updated. New optional setting
   `Database:PosDatabaseName` (default `POS`).
7. Added `modern-app/tools/clear-transactions.sql`, the cleanup used here, guarded by the database name.

## Missing or incomplete (not fixed, for your decision)

**Business gaps**
- Sales: no way to open, print or cancel a posted invoice (no invoice view, no void), no date filter or paging on the list.
- Sales lines are in the base unit only; you cannot sell by Ton or Gram although purchases can.
- Expense and Receipt approval switches in Settings > Approval policies do nothing; expenses post immediately even with approval on.
- Any user who can sell can back-date a sale (tested 2020-01-01); there is no period lock or date limit.
- Treasury transfer: the "Recent transfers" button does nothing.
- Reports: only one summary card page. No stock valuation, item movement, partner statement, daily cash, or profit by item/customer reports.
- Purchase returns on the checklist and multi-currency import costs per line are still open in `RELEASE_CHECKLIST.md`.

**Smaller issues**
- Deleting a posted purchase returns 200 with `deleted:false` instead of an error (the UI does not offer it).
- Manual journals in the main currency store 0 in the foreign columns, unlike every other document.
- Arabic mode shows English treasury names in Receipts and Sales lists.
- Report counts show decimals ("6.00 invoices"); browser tab title says "Design Lab" on every page.
- Sale screen: unit column shows "—" and the price box is too narrow on smaller screens.
- One partner (محمد عوض) has type "Other", which neither sales nor purchases treat as customer or supplier.

## Final state of POS_Test

- Kept: 171 partners, 40 items with units and price history, users admin/adminmb/sysadmin, roles, 1 branch,
  5 treasuries, 2 banks, chart of accounts (17), currencies and rates, settings, locations, company profile, approval policy.
- Cleared: sales, purchases, imports, all returns, receipts/payments, expenses, journals, stock movements and batches,
  disposal requests, and receipt/expense number sequences. All stock and balances are zero; ids restart at 1.
- The test users and role created for this run were removed.
- The real `POS` database is unchanged. Running the same cleanup there needs your go-ahead.
