IF COL_LENGTH(N'dbo.PurchaseLines', N'ExpiryDate') IS NULL ALTER TABLE dbo.PurchaseLines ADD ExpiryDate date NULL;
IF COL_LENGTH(N'dbo.PurchaseLines', N'Barcode') IS NULL ALTER TABLE dbo.PurchaseLines ADD Barcode nvarchar(120) NULL;
IF COL_LENGTH(N'dbo.PurchaseLines', N'BatchNo') IS NULL ALTER TABLE dbo.PurchaseLines ADD BatchNo nvarchar(80) NULL;
