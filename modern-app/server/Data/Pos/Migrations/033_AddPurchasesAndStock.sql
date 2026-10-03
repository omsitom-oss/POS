IF OBJECT_ID(N'dbo.Purchases', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Purchases (
        PurchaseId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Purchases PRIMARY KEY,
        BranchId int NOT NULL,
        SupplierPartnerId int NOT NULL,
        InvoiceNo nvarchar(40) NOT NULL,
        PurchaseDate date NOT NULL,
        Status nvarchar(20) NOT NULL CONSTRAINT DF_Purchases_Status DEFAULT N'DRAFT',
        CurrencyId int NOT NULL,
        Total decimal(19,4) NOT NULL CONSTRAINT DF_Purchases_Total DEFAULT (0),
        Description nvarchar(500) NULL,
        SavedBy int NULL,
        CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Purchases_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Purchases_Branch FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
        CONSTRAINT FK_Purchases_Supplier FOREIGN KEY (SupplierPartnerId) REFERENCES dbo.Partners(PartnerId),
        CONSTRAINT FK_Purchases_Currency FOREIGN KEY (CurrencyId) REFERENCES dbo.Currencies(CurrencyId),
        CONSTRAINT FK_Purchases_User FOREIGN KEY (SavedBy) REFERENCES dbo.Users(UserId),
        CONSTRAINT CK_Purchases_Status CHECK (Status IN (N'DRAFT',N'POSTED')),
        CONSTRAINT CK_Purchases_Total CHECK (Total >= 0),
        CONSTRAINT UQ_Purchases_BranchInvoice UNIQUE (BranchId, InvoiceNo)
    );
    CREATE INDEX IX_Purchases_BranchDate ON dbo.Purchases(BranchId, PurchaseDate, PurchaseId);
END;
IF OBJECT_ID(N'dbo.PurchaseLines', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PurchaseLines (
        PurchaseLineId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_PurchaseLines PRIMARY KEY,
        PurchaseId bigint NOT NULL,
        ItemId bigint NOT NULL,
        UnitSettingId int NULL,
        Quantity decimal(19,4) NOT NULL,
        UnitPrice decimal(19,4) NOT NULL,
        LineTotal AS (Quantity * UnitPrice) PERSISTED,
        CONSTRAINT FK_PurchaseLines_Purchase FOREIGN KEY (PurchaseId) REFERENCES dbo.Purchases(PurchaseId) ON DELETE CASCADE,
        CONSTRAINT FK_PurchaseLines_Item FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
        CONSTRAINT FK_PurchaseLines_Unit FOREIGN KEY (UnitSettingId) REFERENCES dbo.Settings(SettingId),
        CONSTRAINT CK_PurchaseLines_Positive CHECK (Quantity > 0 AND UnitPrice >= 0)
    );
END;
IF OBJECT_ID(N'dbo.StockMovements', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.StockMovements (
        StockMovementId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_StockMovements PRIMARY KEY,
        BranchId int NOT NULL,
        ItemId bigint NOT NULL,
        PurchaseId bigint NULL,
        Quantity decimal(19,4) NOT NULL,
        UnitCost decimal(19,4) NOT NULL,
        PostingStatus nvarchar(20) NOT NULL CONSTRAINT DF_StockMovements_Status DEFAULT N'DRAFT',
        CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_StockMovements_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_StockMovements_Branch FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
        CONSTRAINT FK_StockMovements_Item FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
        CONSTRAINT FK_StockMovements_Purchase FOREIGN KEY (PurchaseId) REFERENCES dbo.Purchases(PurchaseId),
        CONSTRAINT CK_StockMovements_Status CHECK (PostingStatus IN (N'DRAFT',N'POSTED'))
    );
    CREATE INDEX IX_StockMovements_ItemBranch ON dbo.StockMovements(BranchId, ItemId, PostingStatus);
END;
