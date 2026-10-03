# Business rules discovered from source

This is a source-derived baseline, not a complete signed-off specification. Preserve observed behavior until a deliberate change is approved. The highest-risk workflow handlers are sales variants, purchase approval, returns, finance posting, and insurance price determination.

## Sales, invoices and pricing
- Standard and pharmacy sales use different forms and include insurance-specific variants; treat each invoice path as a distinct behavior until compared.
- Sale lines are linked to item and stock batch/patch data; barcode capture is an operator input route. Batch, expiry, and available-quantity handling matter to stock selection.
- Invoice header/detail, stock movements, and account transactions are coordinated in code. The old/new parity check must compare line extension, header total, discount, net, paid/due, customer balance, stock balance, and printed invoice.
- Source contains discount controls and percent-derived discount calculations in purchasing; sale rules require a complete exact calculation trace from all variants before implementation.
- Decimal/double conversions and SQL Server numeric types coexist. Rounding points and displayed precision are not consistently centralized; preserve per-form results and capture boundary cases.
- Invoice patterns include branch codes and padded movement numbers in posting code. Max-plus-one numbering is susceptible to simultaneous operators.

## Purchasing and stock
- Purchase entry can be preliminary/temporary; approval posts durable rows to `Stock`, updates `Purchases` status and approval metadata, removes `TempStocks`, and adds two ledger sides in a SQL transaction.
- `frmNewPurchase` explicitly checks date/lot matching (`CheckGrid` / `FullMatch`) before approval. Confirm exact matching criteria and duplicate-batch behavior in a walkthrough.
- An optional prompt can update item sell price from purchase price: factor 1.3 for category ID 3, otherwise 1.2, rounded with `Math.Round`.
- Purchase line total in the observed approval code is whole price multiplied by quantity; bonus quantity is separately posted. Discount is applied at header level to derive net total. Confirm tax treatment: no universal tax calculation was established in reviewed source excerpts.
- Stock rows record in/out quantities, bonuses, price, patch, expiry, branch, type, pattern and date. Corrections and disposal use separate transaction types/paths.

## Returns, voids and corrections
- Sales and purchase returns have dedicated forms. Return semantics must be checked for original-document link, returned quantity caps, price basis, accounting reversal, and whether inventory is restored.
- Transaction management and archive forms imply edits/void/correction flows, but permitted status transitions and audit retention need explicit walkthrough.
- `frmUpdatePatchDetails` updates stock/patch attributes and references disposals; such edits can affect current balance and expiry reports.

## Payments and account balances
- Partner balances are represented as summed debit minus credit in `Transactions` / `ViewTransaction` helper logic.
- Purchase approval records a debit to account `104001` and a matching credit to supplier account `201001`, with partner ID on the partner side. This is a specific observed posting, not a general chart-of-accounts specification.
- Cheques, payments, invoice reconciliation, late movement, and account reports are separate workflows. Payment allocation ordering, partial-payment behavior, cheque status, and reversal rules require capture.
- Global cash helper sums debit less credit grouped by partner through `ViewTransaction`; confirm whether this is the cashier drawer or a broader balance before redesigning cash/register behavior.

## Insurance
- Insurance pricing derives from contract price lists, contract/group copayment, item in/out-of-coverage configuration, exception rules, and authority fields. Several UNION branches select the winning coverage class; branch precedence is behavior-critical.
- Contract status `Active`, exceptions, group membership, and bill-limit overrides affect invoice pricing/approval. Exact copayment percentages and edge cases need test invoices from each branch.

## Validation and permissions
- Validation often occurs in event handlers and messages rather than a shared rule layer. Preserve button enablement, required selections, quantity/expiry checks, status locks, and confirmation dialogs as observed.
- Purchase actions reject modifying an already confirmed order and display explicit confirmation prompts.
- User management and privileges exist, but enforcement points and whether access is role-based, form-based, or action-based are not fully established by names/catalog alone. Enumerate every permission gate in a targeted source pass.

## Settings and operational behavior
- Branch selection affects stock and invoice patterns; company profile, appearance, insurance module settings, and other configuration affect forms and print output.
- Server `GetDate()` is used in helper code; other forms use client `Date.Today`. Date/time zone and cutoff differences can affect reports and invoice numbering.
- Keyboard flow, barcode scanner behavior, focus transitions, grid editing, and modal search dialogs are part of operator behavior and must be captured, not treated as presentation-only.

## Items to resolve before each migration
For each source form, record exact formulae, rounding stage, status transitions, transaction boundaries, stock/ledger side effects, validation messages, barcode/keyboard workflow, and printed output. Make a sanitized set of golden transactions for comparison against the legacy application.
