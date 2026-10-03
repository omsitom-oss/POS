IF OBJECT_ID(N'dbo.CashBoxes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CashBoxes (
        CashBoxId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_CashBoxes PRIMARY KEY,
        CashBoxCode nvarchar(24) NOT NULL,
        NameAr nvarchar(150) NOT NULL,
        NameEn nvarchar(150) NOT NULL,
        CurrencyId int NOT NULL,
        IsActive bit NOT NULL CONSTRAINT DF_CashBoxes_IsActive DEFAULT (1),
        SortOrder int NOT NULL CONSTRAINT DF_CashBoxes_SortOrder DEFAULT (0),
        CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_CashBoxes_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_CashBoxes_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_CashBoxes_Code UNIQUE (CashBoxCode),
        CONSTRAINT FK_CashBoxes_Currency FOREIGN KEY (CurrencyId) REFERENCES dbo.Currencies(CurrencyId)
    );
    CREATE INDEX IX_CashBoxes_CurrencyActive ON dbo.CashBoxes(CurrencyId, IsActive);
END;
