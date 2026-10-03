# Legacy application analysis overview

## Executive summary
Elite-POS is a single-project VB.NET Windows Forms point-of-sale application targeting .NET Framework 4.8. It serves a pharmacy/retail workflow with standard and pharmacy-specific sales, insurance billing, purchasing and approval, inventory movements, returns, customer and supplier accounts, payment/cheque handling, configuration, user permissions, and operational and financial reports. It connects directly to SQL Server through ADO.NET and uses Crystal Reports.

The application is currently a working desktop system and is being analyzed as the behavioral reference. Business logic is distributed through form event handlers and shared VB modules; SQL is often embedded in those handlers. The live SQL Server catalog scan found 44 tables (429 columns), 20 views, two stored procedures, 33 PK declarations, six FK declarations, and two non-PK user-table indexes (three key columns). The small number of declared FKs means relationships must be inferred from code and naming as well as database constraints.

## Connection and method
The supplied `DESKTOP-HF0QVH9\SQLEXPRESS` instance and `Hsain-Default` database were reachable using Windows Integrated Security. Analysis used static source reads and SQL Server catalog SELECTs. No legacy source files were edited, and no INSERT, UPDATE, DELETE, DDL, or data-changing procedure was executed. The documents are created beside the solution under `docs/legacy-analysis/`.

## Evidence limits
Form purpose, controls, events, and direct SQL object references are recorded in [02-forms-inventory.md](02-forms-inventory.md). The inventory uses source and designer metadata; it is not a live UI walkthrough. A missing direct table match can indicate shared helper use, dynamically assembled SQL, report data sources, or an unreferenced form; it does not establish that a form is unused. Crystal `.rpt` binary layouts and their embedded data sources need separate runtime validation. Exact operator behaviors and edge cases should be signed off form by form before replacement.

## Major parts
- One WinForms application project and shared helper modules.
- SQL Server is the persistence and reporting data source.
- Crystal Reports and typed DataSets provide printed and viewed output.
- Functional areas are sales, purchasing, stock, finance, insurance, settings/master data, reporting, user management, and shared dialogs/controls.

## Requested deliverables
The companion documents cover solution structure, form inventory, database schema and usage, business rules, printing, settings and permissions, risks, architecture/migration sequencing, and a status checklist for every discovered form.


