IF COL_LENGTH(N'dbo.Purchases', N'CountryId') IS NULL
BEGIN
    ALTER TABLE dbo.Purchases ADD CountryId int NULL;
    ALTER TABLE dbo.Purchases ADD CONSTRAINT FK_Purchases_Country FOREIGN KEY (CountryId) REFERENCES dbo.Countries(CountryId);
    CREATE INDEX IX_Purchases_Country ON dbo.Purchases(CountryId, PurchaseId);
END;
