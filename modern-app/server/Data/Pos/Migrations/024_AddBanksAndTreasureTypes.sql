IF OBJECT_ID(N'dbo.Banks', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Banks (
        BankId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Banks PRIMARY KEY,
        BankCode nvarchar(24) NOT NULL,
        NameAr nvarchar(150) NOT NULL,
        NameEn nvarchar(150) NOT NULL,
        IsActive bit NOT NULL CONSTRAINT DF_Banks_IsActive DEFAULT (1),
        SortOrder int NOT NULL CONSTRAINT DF_Banks_SortOrder DEFAULT (0),
        CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Banks_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Banks_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Banks_Code UNIQUE (BankCode)
    );
    CREATE INDEX IX_Banks_Active ON dbo.Banks(IsActive, SortOrder);
END;

IF COL_LENGTH(N'dbo.CashBoxes', N'TreasureType') IS NULL
    ALTER TABLE dbo.CashBoxes ADD TreasureType nvarchar(10) NOT NULL CONSTRAINT DF_CashBoxes_TreasureType DEFAULT ('CASH');
IF COL_LENGTH(N'dbo.CashBoxes', N'BankId') IS NULL
    ALTER TABLE dbo.CashBoxes ADD BankId int NULL;
IF COL_LENGTH(N'dbo.CashBoxes', N'AccountNumber') IS NULL
    ALTER TABLE dbo.CashBoxes ADD AccountNumber nvarchar(100) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_CashBoxes_Bank')
    ALTER TABLE dbo.CashBoxes ADD CONSTRAINT FK_CashBoxes_Bank FOREIGN KEY (BankId) REFERENCES dbo.Banks(BankId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CashBoxes_Bank' AND object_id = OBJECT_ID(N'dbo.CashBoxes'))
    CREATE INDEX IX_CashBoxes_Bank ON dbo.CashBoxes(BankId, IsActive);
