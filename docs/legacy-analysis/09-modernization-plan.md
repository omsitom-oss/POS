# Simple replacement architecture and migration sequence

## Recommended architecture
Use one locally installed desktop application with:

- **UI:** React + TypeScript, a single shared application layout, one centralized theme/style layer, and a small shared component library: `AppLayout`, `PageHeader`, `DataTable`, form controls, `Toolbar`, `Modal`, `ConfirmDialog`, `Tabs`, `StatusBadge`, and buttons. Forms compose these rather than introducing per-form styles.
- **Local host:** a thin Windows desktop shell that starts/hosts the UI and a single local .NET service. The service is the only database boundary; it uses Windows Integrated Security for SQL Server and a SQLite provider for local SQLite files. Keep it in-process or bound to loopback only.
- **Business behavior:** explicit handlers for each migrated form/workflow, kept close to the workflow. Share only rules proven to be common. Do not introduce microservices, queues, or a generalized framework.
- **Data:** select SQL Server or SQLite at local setup. Keep schema migrations versioned. Use provider-specific SQL only where engine differences require it, behind the smallest possible database boundary.
- **Validation:** centralized field-level patterns and messages, with workflow rules enforced in the local service so UI changes cannot bypass stock/ledger checks.
- **Printing:** first preserve existing print outputs as PDF/browser print or direct local printer integration; choose per report after confirming printer needs. Keep report data queries and templates separate from screen layout.
- **Migration tool (later):** a screen in the same application calling a read-only source reader and transactional target writer. Preview source detection, mapping, dependency order, progress/errors, validation totals, and duplicate-run identity before commit.

This adds one local service because browsers cannot safely connect to SQL Server or use Windows Integrated Security directly. It remains a single-user/local deployment shape with one UI and one service, not distributed infrastructure. Package the UI and service together for predictable install/update behavior.

## Shared design system before forms
Set compact spacing, typography, colors, focus states, keyboard behavior, table density, modal rules, and validation messages once. Implement and review the shared controls against representative workflows (dense item list and POS entry) before form migration. Keep DataTable sorting/filtering/paging behavior consistent and configurable rather than custom per page.

## Form-by-form comparison method
For each form: capture legacy screen states and event paths; document SQL and side effects; prepare sanitized example documents; implement only that form plus shared components it needs; compare old/new calculations, validation, stock, ledger, permissions, keyboard flow, and print output; then mark VERIFIED. Do not migrate dependent forms before their shared data/rules are understood.

## Proposed migration order
1. **Foundation:** shell/layout, login/permissions, settings/configuration, logging, database selection, shared design system. Validate user and branch scope before sensitive workflows.
2. **Reference data:** units, categories, manufacturers, generics, items, customers/partners, branches, banks, salespeople, insurance setup. These are dependencies for transactions.
3. **Read-only operational views:** item search, stock view, archives, transaction lookup; verify stock and document balances against legacy.
4. **Purchasing:** new purchase draft, approval/posting, purchase returns. Purchasing is needed to create/understand inventory lots and supplier balances.
5. **Core sales/POS:** standard cashier/invoice, bill lookup, sales return; then pharmacy and insurance sales/returns. Migrate insurance paths only after contract precedence and exceptions are signed off.
6. **Stock operations:** requests, disposal, patch edits, transaction management; verify every movement source and reversal.
7. **Finance:** payments, cheque lifecycle, reconciliation, account balances, late movements; validate partner/account totals and debit-credit balance.
8. **Reports and print:** invoice/GRN, stock/sales/finance reports, archives, statements; compare printed/PDF output and totals.
9. **Migration utility:** after the destination schemas and business rules stabilize, implement detection/mapping/ordering/transactions/progress/validation/restart safeguards, then rehearse on database copies.

Adjust order if business operations require a different cutover, but keep each form independently comparable and deployable. Authentication and branch permissions must be present before live transactional migration.

## Open questions to resolve before approving design
- Is the intended local deployment one workstation or multiple networked POS terminals sharing a central SQL Server?
- Must the application print directly to existing receipt printers, or is PDF/browser print acceptable?
- Which database is the initial operational target: SQL Server, SQLite, or both from first release?
- Are sales/insurance/finance modules actively used in this database and in what order of business priority?
- Should the replacement preserve the existing credential database temporarily, or perform a planned password reset/upgrade?
