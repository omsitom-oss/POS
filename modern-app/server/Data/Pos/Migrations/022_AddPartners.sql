IF OBJECT_ID(N'dbo.Partners', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Partners (
        PartnerId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Partners PRIMARY KEY,
        PublicId uniqueidentifier NOT NULL CONSTRAINT DF_Partners_PublicId DEFAULT NEWID(),
        PartnerCode nvarchar(24) NOT NULL,
        PartnerName nvarchar(200) NOT NULL,
        PartnerTypeCode nvarchar(20) NOT NULL CONSTRAINT DF_Partners_PartnerTypeCode DEFAULT N'CLIENT',
        Phone nvarchar(50) NULL,
        Email nvarchar(254) NULL,
        Address nvarchar(500) NULL,
        City nvarchar(100) NULL,
        SalesManName nvarchar(150) NULL,
        LegacyPartnerId int NULL,
        Status nvarchar(20) NOT NULL CONSTRAINT DF_Partners_Status DEFAULT N'ACTIVE',
        CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Partners_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Partners_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Partners_PublicId UNIQUE (PublicId),
        CONSTRAINT UQ_Partners_PartnerCode UNIQUE (PartnerCode),
        CONSTRAINT CK_Partners_Type CHECK (PartnerTypeCode IN (N'CLIENT', N'SUPPLIER', N'BOTH')),
        CONSTRAINT CK_Partners_Status CHECK (Status IN (N'ACTIVE', N'INACTIVE', N'SUSPENDED'))
    );

    CREATE UNIQUE INDEX UX_Partners_LegacyPartnerId
        ON dbo.Partners(LegacyPartnerId)
        WHERE LegacyPartnerId IS NOT NULL;
    CREATE INDEX IX_Partners_TypeStatus ON dbo.Partners(PartnerTypeCode, Status);
    CREATE INDEX IX_Partners_Name ON dbo.Partners(PartnerName);
END;

IF DB_ID(N'Hsain-Default') IS NOT NULL
BEGIN
    INSERT INTO dbo.Partners
        (LegacyPartnerId, PartnerCode, PartnerName, PartnerTypeCode, Phone, Email, Address, City, SalesManName, Status)
    SELECT source.PartnerID,
           CONCAT(N'PTN-', RIGHT(CONCAT(N'000000', CONVERT(nvarchar(20), source.PartnerID)), 6)),
           LEFT(NULLIF(LTRIM(RTRIM(source.PartnerName)), N''), 200),
           CASE WHEN source.Client = 1 AND source.Supplier = 1 THEN N'BOTH'
                WHEN source.Supplier = 1 THEN N'SUPPLIER' ELSE N'CLIENT' END,
           LEFT(NULLIF(LTRIM(RTRIM(source.PartnerPhone)), N''), 50),
           LEFT(NULLIF(LTRIM(RTRIM(source.PartnerEmail)), N''), 254),
           LEFT(NULLIF(LTRIM(RTRIM(source.PartnerAddress)), N''), 500),
           LEFT(NULLIF(LTRIM(RTRIM(source.PartnerCity)), N''), 100),
           LEFT(NULLIF(LTRIM(RTRIM(source.SalesManName)), N''), 150),
           N'ACTIVE'
    FROM [Hsain-Default].dbo.SettingsPartners AS source
    WHERE NULLIF(LTRIM(RTRIM(source.PartnerName)), N'') IS NOT NULL
      AND NOT EXISTS
          (SELECT 1 FROM dbo.Partners AS existing WHERE existing.LegacyPartnerId = source.PartnerID);
END;
