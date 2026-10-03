CREATE TABLE dbo.Roles (
    RoleId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Roles PRIMARY KEY,
    Name nvarchar(100) NOT NULL,
    IsActive bit NOT NULL CONSTRAINT DF_Roles_IsActive DEFAULT (1),
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Roles_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Roles_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Roles_Name UNIQUE (Name),
    CONSTRAINT CK_Roles_Name_NotBlank CHECK (LEN(LTRIM(RTRIM(Name))) > 0)
);
CREATE TABLE dbo.Permissions (
    PermissionId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Permissions PRIMARY KEY,
    Code nvarchar(100) NOT NULL,
    Name nvarchar(150) NOT NULL,
    Description nvarchar(300) NULL,
    CONSTRAINT UQ_Permissions_Code UNIQUE (Code)
);
CREATE TABLE dbo.RolePermissions (
    RoleId int NOT NULL,
    PermissionId int NOT NULL,
    CONSTRAINT PK_RolePermissions PRIMARY KEY (RoleId, PermissionId),
    CONSTRAINT FK_RolePermissions_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles(RoleId),
    CONSTRAINT FK_RolePermissions_Permissions FOREIGN KEY (PermissionId) REFERENCES dbo.Permissions(PermissionId)
);
CREATE TABLE dbo.UserRoles (
    UserId int NOT NULL,
    RoleId int NOT NULL,
    CONSTRAINT PK_UserRoles PRIMARY KEY (UserId, RoleId),
    CONSTRAINT FK_UserRoles_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles(RoleId)
);
CREATE INDEX IX_RolePermissions_PermissionId ON dbo.RolePermissions(PermissionId);
CREATE INDEX IX_UserRoles_RoleId ON dbo.UserRoles(RoleId);
IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE Code = N'EXCHANGE_RATES_EDIT')
    INSERT INTO dbo.Permissions(Code, Name, Description) VALUES (N'EXCHANGE_RATES_EDIT', N'Change exchange rates', N'Allows saving currency exchange rate changes.');
