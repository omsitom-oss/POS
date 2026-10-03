CREATE TABLE dbo.Currencies (
    CurrencyId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Currencies PRIMARY KEY,
    CurrencyCode nvarchar(20) NOT NULL,
    CurrencyNameEn nvarchar(150) NOT NULL,
    CurrencyNameAr nvarchar(150) NOT NULL,
    Symbol nvarchar(20) NOT NULL CONSTRAINT DF_Currencies_Symbol DEFAULT (N''),
    IsPrimary bit NOT NULL CONSTRAINT DF_Currencies_IsPrimary DEFAULT (0),
    IsActive bit NOT NULL CONSTRAINT DF_Currencies_IsActive DEFAULT (1),
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Currencies_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Currencies_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Currencies_Code UNIQUE (CurrencyCode)
);
CREATE UNIQUE INDEX UX_Currencies_Primary ON dbo.Currencies(IsPrimary) WHERE IsPrimary = 1;
