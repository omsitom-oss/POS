-- Server-side login sessions. Only a SHA-256 hash of the bearer token is stored.
CREATE TABLE dbo.UserSessions (
    SessionId uniqueidentifier NOT NULL CONSTRAINT PK_UserSessions PRIMARY KEY,
    UserId int NOT NULL,
    TokenHash varbinary(32) NOT NULL,
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_UserSessions_CreatedAt DEFAULT (SYSUTCDATETIME()),
    LastSeenAt datetime2(3) NOT NULL CONSTRAINT DF_UserSessions_LastSeenAt DEFAULT (SYSUTCDATETIME()),
    ExpiresAt datetime2(3) NOT NULL,
    RevokedAt datetime2(3) NULL,
    CONSTRAINT UQ_UserSessions_TokenHash UNIQUE (TokenHash),
    CONSTRAINT FK_UserSessions_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId)
);
CREATE INDEX IX_UserSessions_UserId ON dbo.UserSessions(UserId);

-- Failed-login lockout.
ALTER TABLE dbo.Users ADD
    FailedLoginCount int NOT NULL CONSTRAINT DF_Users_FailedLoginCount DEFAULT (0),
    LockedUntil datetime2(3) NULL;

-- Password and lockout events.
CREATE TABLE dbo.SecurityAuditLog (
    AuditId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_SecurityAuditLog PRIMARY KEY,
    OccurredAt datetime2(3) NOT NULL CONSTRAINT DF_SecurityAuditLog_OccurredAt DEFAULT (SYSUTCDATETIME()),
    EventType nvarchar(50) NOT NULL,
    ActorUserId int NULL,
    TargetUserId int NULL,
    Detail nvarchar(300) NULL
);
CREATE INDEX IX_SecurityAuditLog_TargetUserId ON dbo.SecurityAuditLog(TargetUserId, OccurredAt);

-- Permission codes enforced by the API (see Security/PermissionCodes.cs).
DECLARE @permissions TABLE (Code nvarchar(100) NOT NULL, Name nvarchar(150) NOT NULL, Description nvarchar(300) NOT NULL, Operational bit NOT NULL);
INSERT INTO @permissions(Code, Name, Description, Operational) VALUES
    (N'SETTINGS_MANAGE', N'Manage settings', N'Allows changing settings, locations, company profile, currencies, branches, treasuries, banks and approval policies.', 0),
    (N'ITEMS_MANAGE', N'Manage items', N'Allows creating and editing items.', 1),
    (N'PARTNERS_MANAGE', N'Manage partners', N'Allows creating and editing customers and suppliers.', 1),
    (N'SALES_VIEW', N'View sales', N'Allows viewing sales invoices.', 1),
    (N'SALES_CREATE', N'Create sales', N'Allows posting sales invoices.', 1),
    (N'PURCHASES_VIEW', N'View purchases', N'Allows viewing purchases and import shipments.', 1),
    (N'PURCHASES_MANAGE', N'Manage purchases', N'Allows creating, editing, posting and deleting purchase drafts and import costs.', 1),
    (N'INVENTORY_VIEW', N'View inventory', N'Allows viewing stock, batches and inventory requests.', 1),
    (N'INVENTORY_DISPOSE', N'Request disposals', N'Allows requesting inventory disposals.', 1),
    (N'INVENTORY_APPROVE', N'Approve disposals', N'Allows approving inventory disposal requests.', 0),
    (N'TREASURY_VIEW', N'View treasury and accounts', N'Allows viewing receipts, expenses, statements, balances and the chart of accounts.', 1),
    (N'TREASURY_MANAGE', N'Record treasury movements', N'Allows recording receipts, payments, expenses, transfers and manual transactions.', 1),
    (N'REPORTS_VIEW', N'View reports', N'Allows viewing report summaries.', 1),
    (N'ALL_BRANCHES', N'Access all branches', N'Allows reading and writing operational data of branches other than the user''s own.', 0),
    (N'MANAGEMENT_ACCESS', N'Access customer management', N'Allows using the central POSManagement customer registry.', 0);

INSERT INTO dbo.Permissions(Code, Name, Description)
SELECT p.Code, p.Name, p.Description FROM @permissions p
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permissions existing WHERE existing.Code = p.Code);

-- Until now the API checked no permissions, so every role could do everything. To keep existing
-- users working after upgrade, existing roles keep the day-to-day (operational) permissions, and
-- roles that already hold USER_MANAGEMENT (administrators) receive every permission.
-- Administrators should trim roles afterwards in Settings > Roles.
INSERT INTO dbo.RolePermissions(RoleId, PermissionId)
SELECT r.RoleId, perm.PermissionId
FROM dbo.Roles r
JOIN @permissions p ON p.Operational = 1
JOIN dbo.Permissions perm ON perm.Code = p.Code
WHERE NOT EXISTS (SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId = r.RoleId AND rp.PermissionId = perm.PermissionId);

INSERT INTO dbo.RolePermissions(RoleId, PermissionId)
SELECT admin.RoleId, perm.PermissionId
FROM (SELECT DISTINCT rp.RoleId FROM dbo.RolePermissions rp JOIN dbo.Permissions um ON um.PermissionId = rp.PermissionId WHERE um.Code = N'USER_MANAGEMENT') admin
CROSS JOIN dbo.Permissions perm
WHERE NOT EXISTS (SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId = admin.RoleId AND rp.PermissionId = perm.PermissionId);
