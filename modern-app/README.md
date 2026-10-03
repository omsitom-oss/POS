# Elite POS modern foundation

The new application lives here, separate from the legacy WinForms project. It contains the React + TypeScript shell, shared design system, fake-data Design Lab, and one local .NET service for SQL Server/SQLite connectivity.

## Start the application

Run both processes in separate PowerShell terminals from the solution directory.

```powershell
cd modern-app/server
dotnet run
```

```powershell
cd modern-app/frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The service binds only to `127.0.0.1:5080`; Vite proxies `/api` calls. Settings use the POS database through the backend API. The Design Lab is available under the Development navigation and uses in-memory fake data. The header provides English/Arabic direction and Light/Dark appearance (direct toggle; defaults to Light); appearance choice is saved locally. See `docs/ui/` for the shared design-system rules. In the Development profile, customer POS Settings use the local SQL Server database `POS` through backend-only `ConnectionStrings:POS` configuration (Windows Integrated Security).

The Customer Management area uses the separate central `POSManagement` SQL Server database. Configure `ConnectionStrings:POSManagement` with .NET User Secrets or a process environment variable; do not add its connection information to a project file. After verifying the target database, apply the versioned Management schema explicitly from `modern-app/server` with `dotnet run -- --migrate-management`. See [Management migrations](docs/management/04-management-migrations.md). Starting the local service does not apply Management migrations.

## Customer POS Settings database setup

The base service defaults to SQLite via `server/appsettings.json`; the Development profile selects the existing customer POS database `POS` through `ConnectionStrings:POS`. The React frontend has no database access.

```powershell
cd modern-app/server
dotnet run -- --migrate-pos
dotnet run
```

The POS migration verifies the active database name and refuses unexpected existing user objects. Customer POS migrations under `server/Data/Pos/Migrations` remain separate from Management migrations. Never run them against `POSManagement` or the legacy database. See `docs/pos/settings/` for the Settings schema, API, UI, and boundaries.

## Tests

```powershell
dotnet test server.Tests
cd frontend
npm test
```

`server.Tests` hosts the API in memory against a throwaway SQLite file, so it needs no local SQL Server. The migration tests that apply every POS and Management script to an empty SQL Server database run only when `POS_TEST_SQLSERVER` holds a connection string to a disposable server; CI starts one in a container. GitHub Actions (`.github/workflows/ci.yml`) runs both suites, the frontend lint and the frontend build on every pull request and push to `main`.

## Structure

- `frontend/src/app` â€” entry state and locale.
- `frontend/src/components` â€” centralized DataTable, inputs, buttons, dialogs, tabs, badges and UI states.
- `frontend/src/features/design-lab` â€” demonstration screens and fake data.
- `frontend/src/features/management` â€” Management customer list, create form and details.
- `frontend/src/features/settings` — generic Settings administration.
- `frontend/src/layouts` â€” application shell and shared page structure.
- `frontend/src/styles/system.css` â€” design tokens and all shared styles.
- `server/Data` â€” local POS provider factory and versioned-schema infrastructure.
- `server/Data/Management` â€” `POSManagement` connection and isolated Management migration stream.
- `server/Data/Pos` — customer POS migrations, separate from Management.
- `server/Endpoints` and `server/Services` â€” local API routes and Management operations.
- `server/Models` â€” configuration/status models.
- `server/Services` â€” database health and service operations.
- `docs/architecture.md` â€” detailed architecture, RTL, design-system, provider and development decisions.
- `AGENTS.md` â€” permanent collaboration and implementation rules for this application.

