DECLARE @branchId int = (SELECT TOP (1) BranchId FROM dbo.Branches ORDER BY BranchId);
IF @branchId IS NULL
    THROW 51031, 'A branch must exist before assigning POS data.', 1;

IF COL_LENGTH('dbo.Treasuries', 'BranchId') IS NULL
    ALTER TABLE dbo.Treasuries ADD BranchId int NULL;
IF COL_LENGTH('dbo.Partners', 'BranchId') IS NULL
    ALTER TABLE dbo.Partners ADD BranchId int NULL;
IF COL_LENGTH('dbo.Items', 'BranchId') IS NULL
    ALTER TABLE dbo.Items ADD BranchId int NULL;
IF COL_LENGTH('dbo.Transactions', 'BranchId') IS NULL
    ALTER TABLE dbo.Transactions ADD BranchId int NULL;

EXEC sys.sp_executesql N'UPDATE dbo.Treasuries SET BranchId = @id WHERE BranchId IS NULL', N'@id int', @branchId;
EXEC sys.sp_executesql N'UPDATE dbo.Partners SET BranchId = @id WHERE BranchId IS NULL', N'@id int', @branchId;
EXEC sys.sp_executesql N'UPDATE dbo.Items SET BranchId = @id WHERE BranchId IS NULL', N'@id int', @branchId;
EXEC sys.sp_executesql N'UPDATE dbo.Transactions SET BranchId = @id WHERE BranchId IS NULL', N'@id int', @branchId;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Treasuries_Branch')
    ALTER TABLE dbo.Treasuries ADD CONSTRAINT FK_Treasuries_Branch FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Partners_Branch')
    ALTER TABLE dbo.Partners ADD CONSTRAINT FK_Partners_Branch FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Items_Branch')
    ALTER TABLE dbo.Items ADD CONSTRAINT FK_Items_Branch FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Treasuries_BranchId') CREATE INDEX IX_Treasuries_BranchId ON dbo.Treasuries(BranchId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Partners_BranchId') CREATE INDEX IX_Partners_BranchId ON dbo.Partners(BranchId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Items_BranchId') CREATE INDEX IX_Items_BranchId ON dbo.Items(BranchId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Transactions_BranchId') CREATE INDEX IX_Transactions_BranchId ON dbo.Transactions(BranchId);
