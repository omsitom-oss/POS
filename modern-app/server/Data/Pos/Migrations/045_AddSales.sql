IF OBJECT_ID(N'dbo.Sales', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Sales (
        SaleId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Sales PRIMARY KEY,
        BranchId int NOT NULL,
        SaleNo nvarchar(40) NOT NULL,
        SaleDate date NOT NULL,
        CustomerPartnerId int NULL,
        TreasuryId int NOT NULL,
        CurrencyId int NOT NULL,
        Status nvarchar(20) NOT NULL CONSTRAINT DF_Sales_Status DEFAULT N'POSTED',
        Total decimal(19,4) NOT NULL CONSTRAINT DF_Sales_Total DEFAULT (0),
        Discount decimal(19,4) NOT NULL CONSTRAINT DF_Sales_Discount DEFAULT (0),
        Description nvarchar(500) NULL,
        SavedBy int NULL,
        CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Sales_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Sales_Branch FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
        CONSTRAINT FK_Sales_Customer FOREIGN KEY (CustomerPartnerId) REFERENCES dbo.Partners(PartnerId),
        CONSTRAINT FK_Sales_Treasury FOREIGN KEY (TreasuryId) REFERENCES dbo.Treasuries(TreasuryId),
        CONSTRAINT FK_Sales_Currency FOREIGN KEY (CurrencyId) REFERENCES dbo.Currencies(CurrencyId),
        CONSTRAINT FK_Sales_User FOREIGN KEY (SavedBy) REFERENCES dbo.Users(UserId),
        CONSTRAINT CK_Sales_Status CHECK (Status IN (N'POSTED',N'VOID')),
        CONSTRAINT CK_Sales_Total CHECK (Total >= 0),
        CONSTRAINT UQ_Sales_BranchNo UNIQUE (BranchId, SaleNo)
    );
    CREATE INDEX IX_Sales_BranchDate ON dbo.Sales(BranchId, SaleDate, SaleId);
END;
IF OBJECT_ID(N'dbo.SaleLines', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SaleLines (
        SaleLineId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_SaleLines PRIMARY KEY,
        SaleId bigint NOT NULL,
        ItemId bigint NOT NULL,
        Quantity decimal(19,4) NOT NULL,
        UnitPrice decimal(19,4) NOT NULL,
        UnitCost decimal(19,4) NOT NULL CONSTRAINT DF_SaleLines_UnitCost DEFAULT (0),
        LineTotal AS (Quantity * UnitPrice) PERSISTED,
        CONSTRAINT FK_SaleLines_Sale FOREIGN KEY (SaleId) REFERENCES dbo.Sales(SaleId) ON DELETE CASCADE,
        CONSTRAINT FK_SaleLines_Item FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
        CONSTRAINT CK_SaleLines_Positive CHECK (Quantity > 0 AND UnitPrice >= 0)
    );
END;
IF COL_LENGTH(N'dbo.StockMovements', N'SaleId') IS NULL
BEGIN
    ALTER TABLE dbo.StockMovements ADD SaleId bigint NULL;
    ALTER TABLE dbo.StockMovements ADD CONSTRAINT FK_StockMovements_Sale FOREIGN KEY (SaleId) REFERENCES dbo.Sales(SaleId);
    CREATE INDEX IX_StockMovements_Sale ON dbo.StockMovements(SaleId);
END;
