# Management schema

All tables are in the `dbo` schema of the existing `POSManagement` database. Integer identities are internal. External routes use `PublicId`. Every date/time column is `datetime2(3)` in UTC, with `SYSUTCDATETIME()` defaults where a row can be created without an explicit timestamp.

## Tables and columns

`BusinessTypes` (7 columns): `BusinessTypeId int IDENTITY` PK; `Code nvarchar(50)` required; `Name nvarchar(100)` required; `Description nvarchar(500)` nullable; `IsActive bit` required, default 1; `CreatedAt datetime2(3)` and `UpdatedAt datetime2(3)` required, UTC defaults.

`Customers` (16): `CustomerId int IDENTITY` PK; `PublicId uniqueidentifier` required, default NEWID; `CustomerCode nvarchar(24)` required; `BusinessName nvarchar(200)` required; `ContactPerson nvarchar(150)`, `Phone nvarchar(50)`, `Mobile nvarchar(50)`, `Email nvarchar(254)`, `Address nvarchar(500)`, `City nvarchar(100)`, `Country nvarchar(100)`, `TaxNumber nvarchar(100)`, and `Notes nvarchar(1000)` nullable; `Status nvarchar(20)` required, default `ACTIVE`; `CreatedAt` and `UpdatedAt datetime2(3)` required, UTC defaults.

`CustomerBusinessTypes` (4): `CustomerId int` and `BusinessTypeId int` required composite PK/FKs; `IsPrimary bit` required, default 0; `CreatedAt datetime2(3)` required, UTC default.

`Licenses` (12): `LicenseId int IDENTITY` PK; `PublicId uniqueidentifier` required, default NEWID; `CustomerId int` required FK; `LicenseCode nvarchar(100)` required; `IssuedAt datetime2(3)` and `ExpiresAt datetime2(3)` required; `ActivatedAt datetime2(3)` and `RevokedAt datetime2(3)` nullable; `Status nvarchar(20)` required, default `ISSUED`; `Notes nvarchar(1000)` nullable; `CreatedAt` and `UpdatedAt datetime2(3)` required, UTC defaults.

`Deployments` (8): `DeploymentId int IDENTITY` PK; `PublicId uniqueidentifier` required, default NEWID; `CustomerId int` required FK; `DeploymentType nvarchar(30)` required; `HostingMode nvarchar(20)` nullable for local deployments; `Status nvarchar(20)` required, default `PLANNED`; `CreatedAt` and `UpdatedAt datetime2(3)` required, UTC defaults.

`Installations` (12): `InstallationId int IDENTITY` PK; `PublicId uniqueidentifier` required, default NEWID; `CustomerId int` and `DeploymentId int` required composite FK; `DeviceIdentifier nvarchar(100)` required; `DeviceName nvarchar(150)` and `AppVersion nvarchar(50)` nullable; `FirstRegisteredAt datetime2(3)` required, UTC default; `LastSeenAt datetime2(3)` nullable; `Status nvarchar(20)` required, default `ACTIVE`; `CreatedAt` and `UpdatedAt datetime2(3)` required, UTC defaults.

`DatabaseServers` (13): `DatabaseServerId int IDENTITY` PK; `PublicId uniqueidentifier` required, default NEWID; `Code nvarchar(50)`, `Name nvarchar(150)`, `Host nvarchar(255)`, `Engine nvarchar(30)`, `Environment nvarchar(20)`, `SecretReference nvarchar(150)`, and `Status nvarchar(20)` required; `Port int` nullable; `Notes nvarchar(1000)` nullable; `CreatedAt` and `UpdatedAt datetime2(3)` required, UTC defaults. Engine defaults to `SQLSERVER`; status defaults to `ACTIVE`.

`DatabaseAssignments` (11): `DatabaseAssignmentId int IDENTITY` PK; `PublicId uniqueidentifier` required, default NEWID; `CustomerId int`, `DeploymentId int`, `DeploymentType nvarchar(30)`, `DatabaseServerId int`, `DatabaseName sysname`, `HostingMode nvarchar(20)`, and `Status nvarchar(20)` required; `DeploymentType` defaults to `ONLINE`, `Status` defaults to `ACTIVE`; `CreatedAt` and `UpdatedAt datetime2(3)` required, UTC defaults.

`ManagementSchemaMigrations` (3): `Version int` PK; `Description nvarchar(250)` required; `AppliedAtUtc datetime2(3)` required, UTC default.

## Keys, indexes and checks

Unique constraints: `BusinessTypes(Code)`; `Customers(PublicId)` and `(CustomerCode)`; `Licenses(PublicId)` and `(LicenseCode)`; `Deployments(PublicId)`; `Installations(PublicId)` and `(CustomerId, DeviceIdentifier)`; `DatabaseServers(PublicId)` and `(Code)`; `DatabaseAssignments(PublicId)`; `Deployments(DeploymentId, CustomerId)` and `(DeploymentId, CustomerId, DeploymentType, HostingMode)` for composite references.

Other indexes: `CustomerBusinessTypes(BusinessTypeId, CustomerId)`; filtered unique `CustomerBusinessTypes(CustomerId) WHERE IsPrimary=1`; `Licenses(CustomerId, IssuedAt DESC)` and `(Status, ExpiresAt)`; `Deployments(CustomerId, Status)`; `Installations(DeploymentId, Status)`; `DatabaseAssignments(CustomerId, Status)` and `(DatabaseServerId, DatabaseName)`; filtered unique `DatabaseAssignments(DatabaseServerId, DatabaseName) WHERE HostingMode='DEDICATED' AND Status='ACTIVE'`. Shared database assignments may repeat the same server/name for different customers.

CHECK constraints enforce: customer status `ACTIVE|INACTIVE|SUSPENDED`; license status `ISSUED|ACTIVE|EXPIRED|REVOKED`, expiry later than issue, and revoked timestamp present only for `REVOKED`; deployment type `LOCAL_SQLITE|LOCAL_SQLSERVER|ONLINE`, local mode NULL, online mode `SHARED|DEDICATED`, and status `PLANNED|ACTIVE|INACTIVE|DECOMMISSIONED`; installation status `ACTIVE|DISABLED|RETIRED`; server port 1–65535 when provided, engine `SQLSERVER`, environment `PRODUCTION|TEST`, status `ACTIVE|INACTIVE|MAINTENANCE`; assignment is `ONLINE`, mode `SHARED|DEDICATED`, status `ACTIVE|INACTIVE|RETIRED`.

All FKs are non-cascading (`NO ACTION`). Deleting a customer with linked history is rejected. There are no triggers or stored procedures in this schema. The only seeded reference data is the five business types listed in `01-management-overview.md`'s migration and `05-customer-model.md`.
