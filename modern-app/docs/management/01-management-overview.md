# POSManagement overview

`POSManagement` is Elite POS's central control database. Every Elite POS customer is registered here regardless of where that customer's POS data runs. It is separate from customer operational databases.

This phase adds customer registration, configurable business types, and metadata describing licenses, deployments, installations, online database servers and assignments. Only customer create/list/detail and active business-type reads are exposed in the first API slice. License, deployment, server and installation screens and workflows are not implemented.

The database currently holds no POS transactions or customer POS schema. It contains eight Management tables plus one migration-history table. The five initial business types are reference data; more can be added as rows without application builds or schema changes.

## Service boundary

React calls the local .NET service. Only that service reads or writes `POSManagement`, using backend configuration `ConnectionStrings:POSManagement`. API routes use `PublicId`; internal integer identities are not returned. No database address, name, or credentials are returned to React.

## API in this phase

| Method and route | Behavior |
|---|---|
| `GET /api/management/health` | Opens Management SQL Server connection and confirms `DB_NAME()` is `POSManagement`. |
| `GET /api/management/business-types` | Lists active business types. |
| `GET /api/management/customers` | Lists registered customers with the primary business type. |
| `POST /api/management/customers` | Creates a customer and one primary business-type assignment in a transaction. |
| `GET /api/management/customers/{publicId}` | Returns customer details and all assigned business types. |

Customer creation does not create a license, deployment, installation, server or database assignment.

## Configuration first

Customer identity, business classification, deployment mode, online hosting mode, server/database assignment, and secret references are configuration data. Routine onboarding and movement between local and online deployments must not need customer-specific source changes. `CustomerId` remains stable while deployment records change.

## Out of scope

Items, sales, purchasing, stock, accounting, insurance, reports, customer POS schema/provisioning, legacy data migration, mobile clients, online POS APIs, licensing UI and deployment/server management UI are not part of this phase.
