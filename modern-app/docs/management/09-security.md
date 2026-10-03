# Management security

## Credentials and database access

Only the .NET backend connects to `POSManagement`. Its setting is `ConnectionStrings:POSManagement`, loaded from .NET User Secrets in development or protected process configuration in deployment. The value is absent from React, tracked appsettings, migrations and documentation. Connection-string persistence of security information is disabled, and code/logging must not print the full connection string. Database errors returned by the API are sanitized.

The supplied development SQL Server endpoint presented a certificate chain not trusted by the local machine. Development User Secrets were configured to keep SQL encryption enabled while trusting that server certificate for this local connection. This bypasses server certificate identity validation and must not be copied to production; deploy a certificate trusted by the backend host. Rotate credentials if they have been exposed outside the intended development channel.

All user-controlled SQL values are parameters. Internal integer IDs are not returned by APIs; external customer routes use GUID `PublicId`. Customer creation is transactional. API DTOs never include server hosts, database names, secret references or connection strings.

## Local service access

The service binds to loopback and the development browser origins are allow-listed. CORS is not authentication. This first Management slice has no user authentication/authorization, so it is a development/local-administration foundation and must not be exposed on a network or treated as a production multi-user Management console until operator authentication and authorization are added.

## Tenant isolation

Future online POS requests must be authenticated and resolve customer scope on the server. Never trust a client-supplied CustomerId as authorization. Every shared-database query and write must be scoped to that resolved customer; unique constraints/indexes must be tenant-aware. Management server/assignment data stays backend-only.

## Data minimization and history

Installation identifiers are application-generated, not invasive hardware fingerprints. Management foreign keys use non-cascading deletion to protect license, deployment and registration history. Never put POS sales, stock, purchasing or financial operations into `POSManagement`.
