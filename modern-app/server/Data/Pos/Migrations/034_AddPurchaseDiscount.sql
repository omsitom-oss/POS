IF COL_LENGTH(N'dbo.Purchases', N'Discount') IS NULL
    ALTER TABLE dbo.Purchases ADD Discount decimal(19,4) NOT NULL CONSTRAINT DF_Purchases_Discount DEFAULT (0);
