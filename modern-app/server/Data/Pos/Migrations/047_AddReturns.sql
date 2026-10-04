-- Sales returns and purchase returns. Each return is its own document with its own number, linked to the
-- original invoice and to the invoice lines it returns. The original invoice is never changed.
IF OBJECT_ID(N'dbo.SalesReturns', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SalesReturns (
        SalesReturnId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_SalesReturns PRIMARY KEY,
        BranchId int NOT NULL,
        ReturnNo nvarchar(40) NOT NULL,
        ReturnDate date NOT NULL,
        SaleId bigint NOT NULL,
        TreasuryId int NOT NULL,
        CurrencyId int NOT NULL,
        Subtotal decimal(19,4) NOT NULL,
        Discount decimal(19,4) NOT NULL CONSTRAINT DF_SalesReturns_Discount DEFAULT (0),
        Total decimal(19,4) NOT NULL,
        Reason nvarchar(500) NULL,
        Status nvarchar(20) NOT NULL CONSTRAINT DF_SalesReturns_Status DEFAULT N'POSTED',
        SavedBy int NULL,
        CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_SalesReturns_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_SalesReturns_Branch FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
        CONSTRAINT FK_SalesReturns_Sale FOREIGN KEY (SaleId) REFERENCES dbo.Sales(SaleId),
        CONSTRAINT FK_SalesReturns_Treasury FOREIGN KEY (TreasuryId) REFERENCES dbo.Treasuries(TreasuryId),
        CONSTRAINT FK_SalesReturns_Currency FOREIGN KEY (CurrencyId) REFERENCES dbo.Currencies(CurrencyId),
        CONSTRAINT FK_SalesReturns_User FOREIGN KEY (SavedBy) REFERENCES dbo.Users(UserId),
        CONSTRAINT CK_SalesReturns_Status CHECK (Status IN (N'POSTED')),
        CONSTRAINT CK_SalesReturns_Amounts CHECK (Subtotal >= 0 AND Discount >= 0 AND Total >= 0 AND Discount <= Subtotal),
        CONSTRAINT UQ_SalesReturns_BranchNo UNIQUE (BranchId, ReturnNo)
    );
    CREATE INDEX IX_SalesReturns_BranchDate ON dbo.SalesReturns(BranchId, ReturnDate, SalesReturnId);
    CREATE INDEX IX_SalesReturns_Sale ON dbo.SalesReturns(SaleId);
END;
IF OBJECT_ID(N'dbo.SalesReturnLines', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SalesReturnLines (
        SalesReturnLineId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_SalesReturnLines PRIMARY KEY,
        SalesReturnId bigint NOT NULL,
        SaleLineId bigint NOT NULL,
        ItemId bigint NOT NULL,
        Quantity decimal(19,4) NOT NULL,
        UnitPrice decimal(19,4) NOT NULL,
        UnitCost decimal(19,4) NOT NULL,
        LineTotal AS (Quantity * UnitPrice) PERSISTED,
        CONSTRAINT FK_SalesReturnLines_Return FOREIGN KEY (SalesReturnId) REFERENCES dbo.SalesReturns(SalesReturnId),
        CONSTRAINT FK_SalesReturnLines_SaleLine FOREIGN KEY (SaleLineId) REFERENCES dbo.SaleLines(SaleLineId),
        CONSTRAINT FK_SalesReturnLines_Item FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
        CONSTRAINT CK_SalesReturnLines_Positive CHECK (Quantity > 0 AND UnitPrice >= 0)
    );
    CREATE INDEX IX_SalesReturnLines_SaleLine ON dbo.SalesReturnLines(SaleLineId);
END;
IF OBJECT_ID(N'dbo.PurchaseReturns', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PurchaseReturns (
        PurchaseReturnId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_PurchaseReturns PRIMARY KEY,
        BranchId int NOT NULL,
        ReturnNo nvarchar(40) NOT NULL,
        ReturnDate date NOT NULL,
        PurchaseId bigint NOT NULL,
        SupplierPartnerId int NOT NULL,
        CurrencyId int NOT NULL,
        Subtotal decimal(19,4) NOT NULL,
        Discount decimal(19,4) NOT NULL CONSTRAINT DF_PurchaseReturns_Discount DEFAULT (0),
        Total decimal(19,4) NOT NULL,
        Reason nvarchar(500) NULL,
        Status nvarchar(20) NOT NULL CONSTRAINT DF_PurchaseReturns_Status DEFAULT N'PENDING',
        SavedBy int NULL,
        ReviewedBy int NULL,
        ReviewedAt datetime2(3) NULL,
        ReviewNote nvarchar(500) NULL,
        CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_PurchaseReturns_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_PurchaseReturns_Branch FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
        CONSTRAINT FK_PurchaseReturns_Purchase FOREIGN KEY (PurchaseId) REFERENCES dbo.Purchases(PurchaseId),
        CONSTRAINT FK_PurchaseReturns_Supplier FOREIGN KEY (SupplierPartnerId) REFERENCES dbo.Partners(PartnerId),
        CONSTRAINT FK_PurchaseReturns_Currency FOREIGN KEY (CurrencyId) REFERENCES dbo.Currencies(CurrencyId),
        CONSTRAINT FK_PurchaseReturns_SavedBy FOREIGN KEY (SavedBy) REFERENCES dbo.Users(UserId),
        CONSTRAINT FK_PurchaseReturns_ReviewedBy FOREIGN KEY (ReviewedBy) REFERENCES dbo.Users(UserId),
        CONSTRAINT CK_PurchaseReturns_Status CHECK (Status IN (N'PENDING',N'POSTED',N'REJECTED')),
        CONSTRAINT CK_PurchaseReturns_Amounts CHECK (Subtotal >= 0 AND Discount >= 0 AND Total >= 0 AND Discount <= Subtotal),
        CONSTRAINT UQ_PurchaseReturns_BranchNo UNIQUE (BranchId, ReturnNo)
    );
    CREATE INDEX IX_PurchaseReturns_BranchStatus ON dbo.PurchaseReturns(BranchId, Status, ReturnDate);
    CREATE INDEX IX_PurchaseReturns_Purchase ON dbo.PurchaseReturns(PurchaseId);
END;
IF OBJECT_ID(N'dbo.PurchaseReturnLines', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PurchaseReturnLines (
        PurchaseReturnLineId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_PurchaseReturnLines PRIMARY KEY,
        PurchaseReturnId bigint NOT NULL,
        PurchaseLineId bigint NOT NULL,
        ItemId bigint NOT NULL,
        Quantity decimal(19,4) NOT NULL,
        UnitCost decimal(19,4) NOT NULL,
        LineTotal AS (Quantity * UnitCost) PERSISTED,
        CONSTRAINT FK_PurchaseReturnLines_Return FOREIGN KEY (PurchaseReturnId) REFERENCES dbo.PurchaseReturns(PurchaseReturnId),
        CONSTRAINT FK_PurchaseReturnLines_PurchaseLine FOREIGN KEY (PurchaseLineId) REFERENCES dbo.PurchaseLines(PurchaseLineId),
        CONSTRAINT FK_PurchaseReturnLines_Item FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
        CONSTRAINT CK_PurchaseReturnLines_Positive CHECK (Quantity > 0 AND UnitCost >= 0)
    );
    CREATE INDEX IX_PurchaseReturnLines_PurchaseLine ON dbo.PurchaseReturnLines(PurchaseLineId);
END;
IF COL_LENGTH(N'dbo.StockMovements', N'SalesReturnId') IS NULL
BEGIN
    ALTER TABLE dbo.StockMovements ADD SalesReturnId bigint NULL;
    ALTER TABLE dbo.StockMovements ADD CONSTRAINT FK_StockMovements_SalesReturn FOREIGN KEY (SalesReturnId) REFERENCES dbo.SalesReturns(SalesReturnId);
    CREATE INDEX IX_StockMovements_SalesReturn ON dbo.StockMovements(SalesReturnId);
END;
IF COL_LENGTH(N'dbo.StockMovements', N'PurchaseReturnId') IS NULL
BEGIN
    ALTER TABLE dbo.StockMovements ADD PurchaseReturnId bigint NULL;
    ALTER TABLE dbo.StockMovements ADD CONSTRAINT FK_StockMovements_PurchaseReturn FOREIGN KEY (PurchaseReturnId) REFERENCES dbo.PurchaseReturns(PurchaseReturnId);
    CREATE INDEX IX_StockMovements_PurchaseReturn ON dbo.StockMovements(PurchaseReturnId);
END;

-- Separate permissions for creating sales and purchase returns, as in the legacy app (ChReturnSales, ChReturnPurchases).
-- Approving purchase returns already has PURCHASE_RETURN_APPROVE (036). Roles that already hold USER_MANAGEMENT
-- (administrators) get the new permissions; other roles get them in Settings > Roles.
DECLARE @permissions TABLE (Code nvarchar(100) NOT NULL, Name nvarchar(150) NOT NULL, Description nvarchar(300) NOT NULL);
INSERT INTO @permissions(Code, Name, Description) VALUES
    (N'SALES_RETURN', N'Create sales returns', N'Allows returning items from a posted sales invoice and refunding the customer from a treasury.'),
    (N'PURCHASE_RETURN', N'Create purchase returns', N'Allows returning items from a posted purchase invoice to the supplier.');
INSERT INTO dbo.Permissions(Code, Name, Description)
SELECT p.Code, p.Name, p.Description FROM @permissions p
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permissions existing WHERE existing.Code = p.Code);
INSERT INTO dbo.RolePermissions(RoleId, PermissionId)
SELECT admin.RoleId, perm.PermissionId
FROM (SELECT DISTINCT rp.RoleId FROM dbo.RolePermissions rp JOIN dbo.Permissions um ON um.PermissionId = rp.PermissionId WHERE um.Code = N'USER_MANAGEMENT') admin
JOIN dbo.Permissions perm ON perm.Code IN (N'SALES_RETURN', N'PURCHASE_RETURN')
WHERE NOT EXISTS (SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId = admin.RoleId AND rp.PermissionId = perm.PermissionId);
