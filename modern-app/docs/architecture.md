# Foundation architecture

## Hosting decision

The React application remains a browser application and is hosted by Vite during development. It calls one .NET service through `/api`; the service binds to loopback only. No Electron, Tauri, or WebView dependency is included. This is the smallest practical host for a reviewable local foundation and keeps every feature page portable. If Windows desktop packaging is later required, a thin WebView2 shell is the recommended option: it can host the same built React assets and start the local service without adding desktop APIs to business components.

## Runtime shape

```text
React + TypeScript in browser
            |
     same-origin /api
            v
 one local ASP.NET Core service (127.0.0.1:5080)
       /                         \
Microsoft.Data.SqlClient       Microsoft.Data.Sqlite
Windows Integrated Security    local database file
```

The frontend has no database package and contains no connection strings. Vite proxies local API requests while developing. The backend uses one small `DbConnectionFactory`, returning the provider's standard `DbConnection`; handlers can use provider-specific SQL where necessary. No repository or service layer is added until a concrete workflow needs one.

The central Management database is a separate SQL Server connection configured through `ConnectionStrings:POSManagement` in backend-only secret configuration. Management operations use a narrow SQL Server connection factory and do not follow local POS provider selection. React receives Management DTOs and public identifiers, never SQL credentials or database routing details. Customer operational databases and their future migration stream remain separate.

## Database provider selection

The .NET configuration section `Database` selects the local POS provider (`SQLite` or `SqlServer`). The committed base default uses SQLite at `server/data/elite-pos.db`; the Development profile selects SQL Server through `ConnectionStrings:POS` and Windows Integrated Security against the development database named `POS`. Keep this connection in centralized backend configuration. The connection factory rejects SQL username/password authentication for customer POS connections. The separate Management connection remains `ConnectionStrings:POSManagement`, held only in backend User Secrets or environment configuration.

The local POS service offers `/api/health` and `/api/database/provider`. SQLite startup creates only its existing `SchemaMigrations` tracking table. Customer POS migrations live under `server/Data/Pos/Migrations` and are tracked by `dbo.PosSchemaMigrations`; `dotnet run -- --migrate-pos` verifies `DB_NAME()` is `POS`, checks existing objects, and applies changes transactionally. Management remains in its isolated `Data/Management/Migrations` stream. No customer POS migration targets `POSManagement` or the legacy database. SQLite migrations are not part of this Settings phase.

Schema evolution will be introduced in small versioned steps as migrated workflows require it. Provider-specific differences stay local to data access code. There is no attempt to copy or pre-build all 44 legacy tables.

## Central Management and configuration first

`POSManagement` is the control database for customer registrations, business types, license history, deployment configuration, installations, online database servers and assignments. It does not contain POS operational records. Customer identity is the internal `CustomerId` plus stable `PublicId`; deployments and server/database assignments can change without changing customer identity.

Customer-specific values are records, never source-code branches. Names, customer codes, business types, deployment modes, hosting modes, host/database assignments and secret references are managed configuration. Management schema scripts live under `server/Data/Management/Migrations`; the initial migration is applied explicitly with `dotnet run -- --migrate-management` and checks `DB_NAME()` before it writes. This stream is separate from future customer POS migrations. See `docs/management/` for the schema and future tenancy rules.

For shared hosted POS databases, authenticated server-side tenant context determines `CustomerId`. Future operational tables and unique indexes include tenant ownership where needed (for example `UNIQUE(CustomerId, Barcode)`). Client input is not proof of tenant authorization.

## Design system

`frontend/src/styles/system.css` is the only visual token and component styling layer. Semantic tokens define colors, typography, spacing, control heights, radii, shadows, and direction-aware layout rules. The root `data-theme` selects Light or Dark. One direct header button toggles the mode, the choice persists in local storage, and Light is the default; there is no System mode. Shared components in `frontend/src/components` cover buttons, inputs, field layouts, DataTable, modal/confirmation, tabs, status badges, and loading/empty/error feedback.

Feature screens compose these components. They do not add global CSS, bespoke table implementations, or duplicated field/button/dialog styles. Table density, typography, control sizing, and semantic theme colors are centralized so a token/component change updates all feature screens. Simple Add/Edit flows use the shared centered modal by default.

Generic reference settings use the two-table customer POS model `SettingTypes`/`Settings`, with stable type codes and localized Arabic/English values. Use it only for simple lookups; domain-rich or transactional entities receive their own schema when their workflow is implemented. `/settings` shows compact localized SettingType cards with active counts. Flat types use the shared DataTable; hierarchical types use URL-backed card drill-down and clickable breadcrumbs, never a tree UI. Normal screens show only the active language, while bilingual maintenance forms may show both values. See `docs/pos/settings/`.

Locations are a deliberate exception to the generic hierarchy: the existing `LOCATION` card opens dedicated `Countries` and `Cities` tables. Countries and cities keep bilingual names and active/order metadata, with `Cities.CountryId` enforcing ownership. Units and item categories remain on the generic Settings tables.

Company identity is also dedicated configuration: `CompanyProfile` is a single-row POS table used by report and invoice generation. Its logo is stored as Base64 text with a MIME type and is read by the backend report pipeline.

`DataTable<T>` supports configurable columns, sort, whole-row search, selection, row actions, arrow/Home/End/Enter keyboard navigation, loading/empty states, pagination, compact/comfortable density, logical numeric alignment, and RTL/LTR direction. Column renderers handle currency/date presentation. It operates on the rows provided by a screen; server-side query and paging behavior will be added only when a real feature needs it.

## RTL and language

The app language toggle sets the root document `lang` and `dir`; the shell, tables, cards, and forms also receive direction explicitly. CSS uses logical properties for inline/block spacing and alignment. Arabic and English labels are included in the Settings and Design Lab. Product/customer rows in the Design Lab are fake sample content. Real workflow language choices and localized business values can be added with each feature.

## Design Lab

The Design Lab is not connected to a database and is separated from production navigation under Development. Sample products, customers and sale lines are constants in `features/design-lab/sampleData.ts`. Sections demonstrate the shell/navigation, themes, standard and dense tables, edit form and validation, a compact POS grid and totals, customer picker, confirmation dialog, card-based hierarchy navigation, and loading/empty/error states. The service indicator shows backend/provider health only.

## Folder map

```text
modern-app/
  AGENTS.md
  docs/architecture.md
  frontend/
    src/app/
    src/components/
    src/features/design-lab/
    src/features/management/
    src/layouts/
    src/styles/system.css
  server/
    Data/
      Management/Migrations/
    Endpoints/
    Models/
    Services/
  docs/management/
```

The Vite starter may contain unused starter assets/styles; feature code imports only `styles/system.css`.

## Development startup

Requires Node.js 20.19+ and the .NET 9 SDK.

1. In terminal one: `cd modern-app/server`, then `dotnet run`.
2. In terminal two: `cd modern-app/frontend`, then `npm install` once and `npm run dev`.
3. Open `http://127.0.0.1:5173`.

The API is available at `http://127.0.0.1:5080/api/health`. Start the service first so SQLite infrastructure is initialized. Set provider environment variables before `dotnet run` when using a new destination SQL Server. The UI can still be previewed without the service, but its connection indicator will be offline.

