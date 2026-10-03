CREATE TABLE dbo.ManagementSchemaMigrations (
    Version int NOT NULL CONSTRAINT PK_ManagementSchemaMigrations PRIMARY KEY,
    Description nvarchar(250) NOT NULL,
    AppliedAtUtc datetime2(3) NOT NULL CONSTRAINT DF_ManagementSchemaMigrations_AppliedAtUtc DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.BusinessTypes (
    BusinessTypeId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_BusinessTypes PRIMARY KEY,
    Code nvarchar(50) NOT NULL,
    Name nvarchar(100) NOT NULL,
    Description nvarchar(500) NULL,
    IsActive bit NOT NULL CONSTRAINT DF_BusinessTypes_IsActive DEFAULT (1),
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_BusinessTypes_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_BusinessTypes_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_BusinessTypes_Code UNIQUE (Code)
);

CREATE TABLE dbo.Customers (
    CustomerId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Customers PRIMARY KEY,
    PublicId uniqueidentifier NOT NULL CONSTRAINT DF_Customers_PublicId DEFAULT NEWID(),
    CustomerCode nvarchar(24) NOT NULL,
    BusinessName nvarchar(200) NOT NULL,
    ContactPerson nvarchar(150) NULL,
    Phone nvarchar(50) NULL,
    Mobile nvarchar(50) NULL,
    Email nvarchar(254) NULL,
    Address nvarchar(500) NULL,
    City nvarchar(100) NULL,
    Country nvarchar(100) NULL,
    TaxNumber nvarchar(100) NULL,
    Notes nvarchar(1000) NULL,
    Status nvarchar(20) NOT NULL CONSTRAINT DF_Customers_Status DEFAULT N'ACTIVE',
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Customers_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Customers_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Customers_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_Customers_CustomerCode UNIQUE (CustomerCode),
    CONSTRAINT CK_Customers_Status CHECK (Status IN (N'ACTIVE', N'INACTIVE', N'SUSPENDED'))
);

CREATE TABLE dbo.CustomerBusinessTypes (
    CustomerId int NOT NULL,
    BusinessTypeId int NOT NULL,
    IsPrimary bit NOT NULL CONSTRAINT DF_CustomerBusinessTypes_IsPrimary DEFAULT (0),
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_CustomerBusinessTypes_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_CustomerBusinessTypes PRIMARY KEY (CustomerId, BusinessTypeId),
    CONSTRAINT FK_CustomerBusinessTypes_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT FK_CustomerBusinessTypes_BusinessTypes FOREIGN KEY (BusinessTypeId) REFERENCES dbo.BusinessTypes(BusinessTypeId)
);
CREATE UNIQUE INDEX UX_CustomerBusinessTypes_OnePrimary ON dbo.CustomerBusinessTypes(CustomerId) WHERE IsPrimary = 1;
CREATE INDEX IX_CustomerBusinessTypes_BusinessTypeId ON dbo.CustomerBusinessTypes(BusinessTypeId, CustomerId);

CREATE TABLE dbo.Licenses (
    LicenseId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Licenses PRIMARY KEY,
    PublicId uniqueidentifier NOT NULL CONSTRAINT DF_Licenses_PublicId DEFAULT NEWID(),
    CustomerId int NOT NULL,
    LicenseCode nvarchar(100) NOT NULL,
    IssuedAt datetime2(3) NOT NULL,
    ActivatedAt datetime2(3) NULL,
    ExpiresAt datetime2(3) NOT NULL,
    Status nvarchar(20) NOT NULL CONSTRAINT DF_Licenses_Status DEFAULT N'ISSUED',
    RevokedAt datetime2(3) NULL,
    Notes nvarchar(1000) NULL,
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Licenses_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Licenses_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Licenses_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_Licenses_LicenseCode UNIQUE (LicenseCode),
    CONSTRAINT FK_Licenses_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT CK_Licenses_Status CHECK (Status IN (N'ISSUED', N'ACTIVE', N'EXPIRED', N'REVOKED')),
    CONSTRAINT CK_Licenses_ExpirationAfterIssue CHECK (ExpiresAt > IssuedAt),
    CONSTRAINT CK_Licenses_RevocationStatus CHECK ((Status = N'REVOKED' AND RevokedAt IS NOT NULL) OR (Status <> N'REVOKED' AND RevokedAt IS NULL))
);
CREATE INDEX IX_Licenses_CustomerId_IssuedAt ON dbo.Licenses(CustomerId, IssuedAt DESC);
CREATE INDEX IX_Licenses_Status_ExpiresAt ON dbo.Licenses(Status, ExpiresAt);

CREATE TABLE dbo.Deployments (
    DeploymentId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Deployments PRIMARY KEY,
    PublicId uniqueidentifier NOT NULL CONSTRAINT DF_Deployments_PublicId DEFAULT NEWID(),
    CustomerId int NOT NULL,
    DeploymentType nvarchar(30) NOT NULL,
    HostingMode nvarchar(20) NULL,
    Status nvarchar(20) NOT NULL CONSTRAINT DF_Deployments_Status DEFAULT N'PLANNED',
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Deployments_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Deployments_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Deployments_PublicId UNIQUE (PublicId),
    CONSTRAINT FK_Deployments_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT CK_Deployments_Type CHECK (DeploymentType IN (N'LOCAL_SQLITE', N'LOCAL_SQLSERVER', N'ONLINE')),
    CONSTRAINT CK_Deployments_HostingMode CHECK ((DeploymentType = N'ONLINE' AND HostingMode IN (N'SHARED', N'DEDICATED')) OR (DeploymentType IN (N'LOCAL_SQLITE', N'LOCAL_SQLSERVER') AND HostingMode IS NULL)),
    CONSTRAINT CK_Deployments_Status CHECK (Status IN (N'PLANNED', N'ACTIVE', N'INACTIVE', N'DECOMMISSIONED')),
    CONSTRAINT UQ_Deployments_CustomerReference UNIQUE (DeploymentId, CustomerId),
    CONSTRAINT UQ_Deployments_AssignmentReference UNIQUE (DeploymentId, CustomerId, DeploymentType, HostingMode)
);
CREATE INDEX IX_Deployments_CustomerId_Status ON dbo.Deployments(CustomerId, Status);

CREATE TABLE dbo.Installations (
    InstallationId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Installations PRIMARY KEY,
    PublicId uniqueidentifier NOT NULL CONSTRAINT DF_Installations_PublicId DEFAULT NEWID(),
    CustomerId int NOT NULL,
    DeploymentId int NOT NULL,
    DeviceIdentifier nvarchar(100) NOT NULL,
    DeviceName nvarchar(150) NULL,
    AppVersion nvarchar(50) NULL,
    FirstRegisteredAt datetime2(3) NOT NULL CONSTRAINT DF_Installations_FirstRegisteredAt DEFAULT SYSUTCDATETIME(),
    LastSeenAt datetime2(3) NULL,
    Status nvarchar(20) NOT NULL CONSTRAINT DF_Installations_Status DEFAULT N'ACTIVE',
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Installations_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Installations_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Installations_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_Installations_CustomerDevice UNIQUE (CustomerId, DeviceIdentifier),
    CONSTRAINT FK_Installations_CustomerDeployment FOREIGN KEY (DeploymentId, CustomerId) REFERENCES dbo.Deployments(DeploymentId, CustomerId),
    CONSTRAINT CK_Installations_Status CHECK (Status IN (N'ACTIVE', N'DISABLED', N'RETIRED'))
);
CREATE INDEX IX_Installations_DeploymentId_Status ON dbo.Installations(DeploymentId, Status);

CREATE TABLE dbo.DatabaseServers (
    DatabaseServerId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_DatabaseServers PRIMARY KEY,
    PublicId uniqueidentifier NOT NULL CONSTRAINT DF_DatabaseServers_PublicId DEFAULT NEWID(),
    Code nvarchar(50) NOT NULL,
    Name nvarchar(150) NOT NULL,
    Host nvarchar(255) NOT NULL,
    Port int NULL,
    Engine nvarchar(30) NOT NULL CONSTRAINT DF_DatabaseServers_Engine DEFAULT N'SQLSERVER',
    Environment nvarchar(20) NOT NULL,
    SecretReference nvarchar(150) NOT NULL,
    Status nvarchar(20) NOT NULL CONSTRAINT DF_DatabaseServers_Status DEFAULT N'ACTIVE',
    Notes nvarchar(1000) NULL,
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_DatabaseServers_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_DatabaseServers_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_DatabaseServers_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_DatabaseServers_Code UNIQUE (Code),
    CONSTRAINT CK_DatabaseServers_Port CHECK (Port IS NULL OR Port BETWEEN 1 AND 65535),
    CONSTRAINT CK_DatabaseServers_Engine CHECK (Engine = N'SQLSERVER'),
    CONSTRAINT CK_DatabaseServers_Environment CHECK (Environment IN (N'PRODUCTION', N'TEST')),
    CONSTRAINT CK_DatabaseServers_Status CHECK (Status IN (N'ACTIVE', N'INACTIVE', N'MAINTENANCE'))
);

CREATE TABLE dbo.DatabaseAssignments (
    DatabaseAssignmentId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_DatabaseAssignments PRIMARY KEY,
    PublicId uniqueidentifier NOT NULL CONSTRAINT DF_DatabaseAssignments_PublicId DEFAULT NEWID(),
    CustomerId int NOT NULL,
    DeploymentId int NOT NULL,
    DeploymentType nvarchar(30) NOT NULL CONSTRAINT DF_DatabaseAssignments_DeploymentType DEFAULT N'ONLINE',
    DatabaseServerId int NOT NULL,
    DatabaseName sysname NOT NULL,
    HostingMode nvarchar(20) NOT NULL,
    Status nvarchar(20) NOT NULL CONSTRAINT DF_DatabaseAssignments_Status DEFAULT N'ACTIVE',
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_DatabaseAssignments_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_DatabaseAssignments_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_DatabaseAssignments_PublicId UNIQUE (PublicId),
    CONSTRAINT FK_DatabaseAssignments_CustomerDeployment FOREIGN KEY (DeploymentId, CustomerId, DeploymentType, HostingMode) REFERENCES dbo.Deployments(DeploymentId, CustomerId, DeploymentType, HostingMode),
    CONSTRAINT FK_DatabaseAssignments_DatabaseServers FOREIGN KEY (DatabaseServerId) REFERENCES dbo.DatabaseServers(DatabaseServerId),
    CONSTRAINT CK_DatabaseAssignments_OnlineOnly CHECK (DeploymentType = N'ONLINE'),
    CONSTRAINT CK_DatabaseAssignments_HostingMode CHECK (HostingMode IN (N'SHARED', N'DEDICATED')),
    CONSTRAINT CK_DatabaseAssignments_Status CHECK (Status IN (N'ACTIVE', N'INACTIVE', N'RETIRED'))
);
CREATE INDEX IX_DatabaseAssignments_CustomerId_Status ON dbo.DatabaseAssignments(CustomerId, Status);
CREATE INDEX IX_DatabaseAssignments_Server_Database ON dbo.DatabaseAssignments(DatabaseServerId, DatabaseName);
CREATE UNIQUE INDEX UX_DatabaseAssignments_ActiveDedicatedDatabase ON dbo.DatabaseAssignments(DatabaseServerId, DatabaseName)
    WHERE HostingMode = N'DEDICATED' AND Status = N'ACTIVE';

INSERT INTO dbo.BusinessTypes (Code, Name, Description)
VALUES
    (N'PHARMACY', N'Pharmacy', N'Pharmacy and healthcare retail'),
    (N'SUPERMARKET', N'Supermarket', N'Grocery and supermarket retail'),
    (N'ELECTRONICS', N'Electronics', N'Consumer electronics retail'),
    (N'GENERAL_RETAIL', N'General Retail', N'General retail business'),
    (N'WHOLESALE', N'Wholesale', N'Wholesale business');
