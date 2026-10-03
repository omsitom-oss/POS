IF COL_LENGTH(N'dbo.Purchases', N'PurchaseType') IS NULL
BEGIN
    ALTER TABLE dbo.Purchases ADD PurchaseType nvarchar(20) NOT NULL CONSTRAINT DF_Purchases_PurchaseType DEFAULT N'LOCAL';
END;
IF COL_LENGTH(N'dbo.Purchases', N'ExchangeRateToBase') IS NULL
BEGIN
    ALTER TABLE dbo.Purchases ADD ExchangeRateToBase decimal(19,8) NOT NULL CONSTRAINT DF_Purchases_ExchangeRateToBase DEFAULT (1);
END;
IF COL_LENGTH(N'dbo.Purchases', N'LandedCostBase') IS NULL
BEGIN
    ALTER TABLE dbo.Purchases ADD LandedCostBase decimal(19,4) NULL;
END;
IF COL_LENGTH(N'dbo.Purchases', N'ReceivedAt') IS NULL
BEGIN
    ALTER TABLE dbo.Purchases ADD ReceivedAt datetime2(3) NULL;
END;
IF OBJECT_ID(N'dbo.PurchaseAdditionalCosts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PurchaseAdditionalCosts (
        PurchaseCostId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_PurchaseAdditionalCosts PRIMARY KEY,
        PurchaseId bigint NOT NULL,
        CostType nvarchar(40) NOT NULL,
        Amount decimal(19,4) NOT NULL,
        CurrencyId int NOT NULL,
        ExchangeRateToBase decimal(19,8) NOT NULL,
        BaseAmount decimal(19,4) NOT NULL,
        Description nvarchar(250) NULL,
        CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_PurchaseAdditionalCosts_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_PurchaseAdditionalCosts_Purchase FOREIGN KEY (PurchaseId) REFERENCES dbo.Purchases(PurchaseId) ON DELETE CASCADE,
        CONSTRAINT FK_PurchaseAdditionalCosts_Currency FOREIGN KEY (CurrencyId) REFERENCES dbo.Currencies(CurrencyId),
        CONSTRAINT CK_PurchaseAdditionalCosts_Amount CHECK (Amount >= 0 AND ExchangeRateToBase > 0 AND BaseAmount >= 0)
    );
    CREATE INDEX IX_PurchaseAdditionalCosts_Purchase ON dbo.PurchaseAdditionalCosts(PurchaseId, PurchaseCostId);
END;
