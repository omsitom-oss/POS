# Management ERD

```mermaid
erDiagram
    Customers ||--o{ CustomerBusinessTypes : classified_as
    BusinessTypes ||--o{ CustomerBusinessTypes : assigned_to
    Customers ||--o{ Licenses : license_history
    Customers ||--o{ Deployments : configured_for
    Deployments ||--o{ Installations : used_by
    Customers ||--o{ Installations : registers
    Customers ||--o{ DatabaseAssignments : hosted_as
    Deployments ||--o{ DatabaseAssignments : routes_to
    DatabaseServers ||--o{ DatabaseAssignments : stores_on

    Customers {
        int CustomerId PK
        uniqueidentifier PublicId UK
        nvarchar CustomerCode UK
        nvarchar BusinessName
        nvarchar Status
        datetime2 CreatedAt
    }
    BusinessTypes {
        int BusinessTypeId PK
        nvarchar Code UK
        nvarchar Name
        bit IsActive
    }
    CustomerBusinessTypes {
        int CustomerId PK,FK
        int BusinessTypeId PK,FK
        bit IsPrimary
        datetime2 CreatedAt
    }
    Licenses {
        int LicenseId PK
        uniqueidentifier PublicId UK
        int CustomerId FK
        nvarchar LicenseCode UK
        datetime2 IssuedAt
        datetime2 ExpiresAt
        nvarchar Status
    }
    Deployments {
        int DeploymentId PK
        uniqueidentifier PublicId UK
        int CustomerId FK
        nvarchar DeploymentType
        nvarchar HostingMode
        nvarchar Status
    }
    Installations {
        int InstallationId PK
        uniqueidentifier PublicId UK
        int CustomerId FK
        int DeploymentId FK
        nvarchar DeviceIdentifier
        nvarchar Status
    }
    DatabaseServers {
        int DatabaseServerId PK
        uniqueidentifier PublicId UK
        nvarchar Code UK
        nvarchar Host
        nvarchar SecretReference
        nvarchar Status
    }
    DatabaseAssignments {
        int DatabaseAssignmentId PK
        uniqueidentifier PublicId UK
        int CustomerId FK
        int DeploymentId FK
        int DatabaseServerId FK
        sysname DatabaseName
        nvarchar HostingMode
    }
```

`CustomerBusinessTypes` uses `(CustomerId, BusinessTypeId)` as its primary key. A filtered unique index permits at most one primary assignment per customer. `Installations` references `(DeploymentId, CustomerId)` together so it cannot point to another customer's deployment. `DatabaseAssignments` includes the constrained online deployment type and hosting mode in a composite foreign key; this makes local deployments ineligible for online assignments and keeps the assignment mode consistent with its deployment.

All foreign keys use `NO ACTION` deletion behavior. Management history is preserved unless an operator explicitly removes dependent records in a deliberate maintenance operation.
