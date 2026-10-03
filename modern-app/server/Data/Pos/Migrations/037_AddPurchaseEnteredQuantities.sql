IF COL_LENGTH(N'dbo.PurchaseLines', N'OriginalUnitSettingId') IS NULL
    ALTER TABLE dbo.PurchaseLines ADD OriginalUnitSettingId int NULL;
IF COL_LENGTH(N'dbo.PurchaseLines', N'OriginalQuantity') IS NULL
    ALTER TABLE dbo.PurchaseLines ADD OriginalQuantity decimal(19,4) NULL;
IF COL_LENGTH(N'dbo.PurchaseLines', N'OriginalUnitPrice') IS NULL
    ALTER TABLE dbo.PurchaseLines ADD OriginalUnitPrice decimal(19,4) NULL;
