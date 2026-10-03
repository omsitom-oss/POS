IF OBJECT_ID(N'dbo.ApprovalSettings', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ApprovalSettings (
        RequestType nvarchar(50) NOT NULL CONSTRAINT PK_ApprovalSettings PRIMARY KEY,
        RequiresApproval bit NOT NULL CONSTRAINT DF_ApprovalSettings_RequiresApproval DEFAULT (1),
        UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_ApprovalSettings_UpdatedAt DEFAULT (SYSUTCDATETIME())
    );
END;
IF NOT EXISTS (SELECT 1 FROM dbo.ApprovalSettings WHERE RequestType=N'INVENTORY_DISPOSAL')
    INSERT INTO dbo.ApprovalSettings(RequestType,RequiresApproval) VALUES(N'INVENTORY_DISPOSAL',1);
IF OBJECT_ID(N'dbo.InventoryRequests', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.InventoryRequests (
        RequestId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_InventoryRequests PRIMARY KEY,
        RequestType nvarchar(50) NOT NULL,
        BranchId int NOT NULL,
        ItemId bigint NOT NULL,
        PurchaseLineId bigint NULL,
        Quantity decimal(19,4) NOT NULL,
        Reason nvarchar(500) NOT NULL,
        Status nvarchar(20) NOT NULL CONSTRAINT DF_InventoryRequests_Status DEFAULT (N'PENDING'),
        RequestedBy int NULL,
        ReviewedBy int NULL,
        CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_InventoryRequests_CreatedAt DEFAULT (SYSUTCDATETIME()),
        ReviewedAt datetime2(3) NULL,
        ReviewNote nvarchar(500) NULL,
        CONSTRAINT FK_InventoryRequests_Branch FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
        CONSTRAINT FK_InventoryRequests_Item FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
        CONSTRAINT FK_InventoryRequests_PurchaseLine FOREIGN KEY (PurchaseLineId) REFERENCES dbo.PurchaseLines(PurchaseLineId),
        CONSTRAINT FK_InventoryRequests_RequestedBy FOREIGN KEY (RequestedBy) REFERENCES dbo.Users(UserId),
        CONSTRAINT FK_InventoryRequests_ReviewedBy FOREIGN KEY (ReviewedBy) REFERENCES dbo.Users(UserId)
    );
END;
