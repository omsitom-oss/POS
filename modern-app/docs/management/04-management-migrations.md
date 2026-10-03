# Management migrations

Management migrations affect only `POSManagement`. They are a different stream from both the local POS `SchemaMigrations` table and any future customer POS database migrations.

Scripts are embedded from `server/Data/Management/Migrations`. `ManagementMigrationRunner` opens the configured Management connection, verifies `DB_NAME()` equals exactly `POSManagement`, and runs the initial schema and history record in one SQL Server transaction. If migration history is absent (or has no applied version) but user tables/views/procedures/functions/triggers already exist, it refuses to write. A database with version 1 is left unchanged on repeat runs; a newer version is rejected by an older runner. Migration SQL, seed rows and history record roll back together on failure.

## Configure local development

From `modern-app/server`, configure the connection supplied by the database owner in .NET User Secrets (never in appsettings or source):

```powershell
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:POSManagement" "<protected POSManagement connection string>"
```

For a machine that does not use User Secrets, the backend can read `ConnectionStrings__POSManagement` from its process environment. Production should use a trusted SQL Server TLS certificate. Do not enable certificate-validation bypass as a permanent production setting.

## Apply and inspect

From `modern-app/server` with the Development launch profile:

```powershell
dotnet run -- --migrate-management
```

This explicit command applies Management schema version 1 and exits. Starting `dotnet run` normally does not run Management migrations. The connection factory also rejects a configured initial catalog other than `POSManagement`.

Version 1 creates the eight Management tables and `ManagementSchemaMigrations`, and seeds five `BusinessTypes`. No customer POS tables or customer rows are created. Keep each later Management schema change as another ordered script/version; create a distinct runner/table for future customer POS migrations.
