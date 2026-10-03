CREATE TABLE dbo.Branches (
    BranchId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Branches PRIMARY KEY,
    BranchCode nvarchar(50) NOT NULL,
    NameAr nvarchar(150) NOT NULL,
    NameEn nvarchar(150) NOT NULL,
    IsActive bit NOT NULL CONSTRAINT DF_Branches_IsActive DEFAULT (1),
    SortOrder int NOT NULL CONSTRAINT DF_Branches_SortOrder DEFAULT (0),
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Branches_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Branches_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Branches_BranchCode UNIQUE (BranchCode),
    CONSTRAINT CK_Branches_SortOrder CHECK (SortOrder >= 0)
);

CREATE INDEX IX_Branches_ActiveSort ON dbo.Branches(IsActive, SortOrder, NameEn);
