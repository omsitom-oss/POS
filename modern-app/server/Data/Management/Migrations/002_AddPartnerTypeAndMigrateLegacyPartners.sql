EXEC(N'ALTER TABLE dbo.Customers ADD LegacyPartnerId int NULL, PartnerTypeCode nvarchar(20) NOT NULL CONSTRAINT DF_Customers_PartnerTypeCode DEFAULT N''CLIENT'';');
EXEC(N'ALTER TABLE dbo.Customers ADD CONSTRAINT CK_Customers_PartnerTypeCode CHECK (PartnerTypeCode IN (N''CLIENT'', N''SUPPLIER'', N''BOTH''));');
EXEC(N'CREATE UNIQUE INDEX UX_Customers_LegacyPartnerId ON dbo.Customers(LegacyPartnerId) WHERE LegacyPartnerId IS NOT NULL;');
EXEC(N'CREATE INDEX IX_Customers_PartnerTypeCode ON dbo.Customers(PartnerTypeCode);');
IF DB_ID(N'Hsain-Default') IS NOT NULL
EXEC(N'INSERT INTO dbo.Customers (LegacyPartnerId, PublicId, CustomerCode, BusinessName, Phone, Address, City, Email, PartnerTypeCode, Status)
SELECT source.PartnerID, NEWID(), CONCAT(N''LEGACY-PTN-'', RIGHT(CONCAT(N''000000'', CONVERT(nvarchar(20), source.PartnerID)), 6)), source.PartnerName,
       NULLIF(LTRIM(RTRIM(source.PartnerPhone)), N''''), NULLIF(LTRIM(RTRIM(source.PartnerAddress)), N''''),
       NULLIF(LTRIM(RTRIM(source.PartnerCity)), N''''), NULLIF(LTRIM(RTRIM(source.PartnerEmail)), N''''),
       CASE WHEN source.Client = 1 AND source.Supplier = 1 THEN N''BOTH'' WHEN source.Supplier = 1 THEN N''SUPPLIER'' ELSE N''CLIENT'' END, N''ACTIVE''
FROM [Hsain-Default].dbo.SettingsPartners AS source
WHERE NOT EXISTS (SELECT 1 FROM dbo.Customers AS existing WHERE existing.LegacyPartnerId = source.PartnerID);');
