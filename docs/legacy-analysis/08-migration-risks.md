# Migration risks

1. **Business logic is embedded in forms.** Rebuilding without a source-form behavior sheet can omit branches, validations, status locks, or side effects.
2. **Relationship constraints are sparse.** The live catalog declares six FKs across 44 tables; orphan and logical links may exist and require mapping by actual data and code.
3. **Identifier generation is not uniformly concurrency-safe.** `MAX(id)+1` and max movement-number patterns can collide under simultaneous operators.
4. **Mixed transaction coverage.** Some posting paths use SQL transactions; others may partially complete. New behavior must be compared carefully, not silently normalized.
5. **Mixed parameterization.** SQL concatenation risks quoting/encoding errors and injection; migration should parameterize while preserving semantics.
6. **Accounting and stock are coupled.** A sale, purchase, return, or disposal can affect document, stock, partner balance, and ledger. Partial writes create reconciliation issues.
7. **Money and rounding.** VB `Double`, .NET rounding, SQL numeric precision, and formatted text may differ from TypeScript/SQLite/SQL Server calculations.
8. **Insurance price precedence.** Price lists, coverage groups, exceptions, and copayments combine via query unions and require scenario tests.
9. **Authentication and secrets.** Password comparison appears plaintext; `App.config` contains environment-specific and remote credentials. Secure replacement requires credential migration and secret handling.
10. **Windows integrated authentication.** A browser cannot connect directly to SQL Server using the operator's integrated identity. Local service identity and permissions must be designed.
11. **Crystal Reports and printers.** Layout, Arabic rendering, saved logins, paper/printer defaults, and immediate printing can change operator outcomes.
12. **External build/runtime dependencies.** Crystal runtime and two DLL references outside the project tree complicate deployment and clean rebuilds.
13. **SQLite parity.** SQL Server views, T-SQL functions, data types, and concurrency semantics do not map one-to-one to SQLite.
14. **Data quality and null conventions.** Defaults, nullable columns, sentinel IDs, and blank strings are used together; migration must preserve raw meanings.
15. **Operational shortcuts.** Barcode input, keyboard focus, grid editing, modal selectors and rapid repeated sales need measured latency and keyboard parity.
16. **Archives and legacy artifacts.** Backup project/report assets may describe older behavior and need provenance before reuse.

## Required safeguards for eventual migration
Use a detected source version/schema signature; stage mappings; migrate in dependency order inside transactions; preserve source IDs or deterministic key maps; record migration identity for duplicate protection; validate row counts, key coverage, stock quantities, invoice totals, partner balances, and debit/credit totals; report row-level failures; support rollback or restart from a verified checkpoint. None of this migration utility is implemented in this phase.
