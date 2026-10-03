# Online database hosting

`DatabaseServers` represents online SQL Server environments managed by Elite POS. A local customer's SQL Server is not entered here. Each server has a unique code/PublicId, host, optional port, engine `SQLSERVER`, environment `PRODUCTION|TEST`, status `ACTIVE|INACTIVE|MAINTENANCE`, and a required `SecretReference`. That reference is a non-secret backend configuration key; raw passwords and complete connection strings never belong in Management rows.

`DatabaseAssignments` associates an online customer deployment with a managed server and database name. In shared hosting, multiple customers intentionally point to the same physical database. In dedicated hosting, an active server/database pair is unique to one assignment. These rows describe routing only; this phase does not create or connect to customer POS databases.

The future flow is:

```text
Desktop or mobile client
        -> authenticated API
        -> server-side customer/tenant resolution
        -> Management assignment lookup
        -> protected server secret reference
        -> customer POS database
```

The client never supplies credentials or chooses an arbitrary database. For shared POS databases, every customer-owned operational row must have a tenant owner, normally `CustomerId`. Unique keys and indexes must include that owner where values are tenant-local (for example `UNIQUE(CustomerId, Barcode)`). The authenticated server context, not request JSON, authorizes the tenant.
