# Solution structure

## Projects and runtime
- `Elite-POS.sln` contains one VB project, `Elite-POS/Elite-POS.vbproj`.
- Classic MSBuild Windows Forms project, .NET Framework 4.8, `WinExe`; root namespace `Elite_POS`; output assembly `Elite-POS-Hsain`.
- AnyCPU, x86, and x64 Debug/Release configurations. VB `Option Strict Off` and `Option Explicit On`.
- Startup object `Elite_POS.My.MyApplication`; application events and login form establish startup flow.
- References include .NET WinForms/ADO.NET, Crystal Reports 13, MetroFramework, Bunifu UI and EgyCurr libraries. Two external DLL references use paths outside this repository, a deployment/build reproducibility risk.

## Functional source areas
- `Modules/Sales`: POS and pharmacy invoices, returns, cashier, packages, bill lookup, patch/batch details.
- `Modules/Purchase`: purchase invoices, approval, returns.
- `Modules/Stock`, `Modules/Disposes`, `Modules/Requests`: stock view, disposal, internal requests.
- `Modules/Finance`: payments, balances, cheque management, reconciliation, late movements, reports.
- `Modules/Insurance`: contracts, exceptions, covered/out-of-cover items, limits, approval and sync.
- `Modules/Settings`: items, customers/partners, units, categories, banks, salespeople and insurance references.
- `Modules/Reporting`: sales/stock reports and invoice/GRN archives.
- `Modules/User Managment`: user and privilege forms (legacy folder spelling retained here).
- `Public Forms`, `Controls`, root modules: shared dialogs, company/branch/theme configuration, filtering, barcode, report viewer, global utilities and state.
- `Modules/*/Reports` and `Data Sets`: Crystal templates, wrappers and typed datasets.

## Project notes
The project file explicitly lists source inputs. The solution root also contains `Crystal Reports Backup Files`; these are archival clues and are not assumed to be active build inputs. `bin`, `obj`, `.vs`, and package artifacts were excluded from form/source inventory. The project depends on a local SQL Server instance and Crystal runtime, so a React browser UI alone cannot directly use Windows integrated SQL connections. A local service process is needed for local operation and database access.
