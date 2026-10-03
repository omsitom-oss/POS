CREATE TABLE dbo.SettingTypes (
    SettingTypeId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_SettingTypes PRIMARY KEY,
    Code nvarchar(50) NOT NULL,
    NameAr nvarchar(150) NOT NULL,
    NameEn nvarchar(150) NOT NULL,
    Icon nvarchar(100) NULL,
    IsHierarchical bit NOT NULL CONSTRAINT DF_SettingTypes_IsHierarchical DEFAULT (0),
    IsActive bit NOT NULL CONSTRAINT DF_SettingTypes_IsActive DEFAULT (1),
    SortOrder int NOT NULL CONSTRAINT DF_SettingTypes_SortOrder DEFAULT (0),
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_SettingTypes_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_SettingTypes_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_SettingTypes_Code UNIQUE (Code),
    CONSTRAINT CK_SettingTypes_SortOrder CHECK (SortOrder >= 0)
);

CREATE TABLE dbo.Settings (
    SettingId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Settings PRIMARY KEY,
    SettingTypeId int NOT NULL,
    ParentSettingId int NULL,
    Code nvarchar(50) NULL,
    ValueAr nvarchar(200) NOT NULL,
    ValueEn nvarchar(200) NOT NULL,
    Icon nvarchar(100) NULL,
    SortOrder int NOT NULL CONSTRAINT DF_Settings_SortOrder DEFAULT (0),
    IsActive bit NOT NULL CONSTRAINT DF_Settings_IsActive DEFAULT (1),
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Settings_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Settings_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Settings_SettingTypes FOREIGN KEY (SettingTypeId) REFERENCES dbo.SettingTypes(SettingTypeId),
    CONSTRAINT UQ_Settings_Id_Type UNIQUE (SettingId, SettingTypeId),
    CONSTRAINT FK_Settings_ParentSameType FOREIGN KEY (ParentSettingId, SettingTypeId) REFERENCES dbo.Settings(SettingId, SettingTypeId),
    CONSTRAINT CK_Settings_NotOwnParent CHECK (ParentSettingId IS NULL OR ParentSettingId <> SettingId),
    CONSTRAINT CK_Settings_SortOrder CHECK (SortOrder >= 0)
);

CREATE INDEX IX_Settings_SettingTypeId ON dbo.Settings(SettingTypeId);
CREATE INDEX IX_Settings_ParentSettingId ON dbo.Settings(ParentSettingId);
CREATE INDEX IX_Settings_Type_Parent ON dbo.Settings(SettingTypeId, ParentSettingId);
CREATE UNIQUE INDEX UX_Settings_Type_Code ON dbo.Settings(SettingTypeId, Code) WHERE Code IS NOT NULL;

INSERT INTO dbo.SettingTypes (Code, NameAr, NameEn, Icon, IsHierarchical, IsActive, SortOrder)
VALUES
    (N'UNIT', N'الوحدات', N'Units', N'scale', 0, 1, 1),
    (N'ITEM_CATEGORY', N'تصنيفات الأصناف', N'Item Categories', N'folder', 1, 1, 2),
    (N'LOCATION', N'المواقع', N'Locations', N'map-pin', 1, 1, 3);
