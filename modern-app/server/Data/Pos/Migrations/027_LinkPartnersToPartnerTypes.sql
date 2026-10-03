DECLARE @partnerTypeId int = (SELECT SettingTypeId FROM dbo.SettingTypes WHERE Code = N'PARTNER_TYPE');

IF @partnerTypeId IS NULL
BEGIN
    INSERT INTO dbo.SettingTypes (Code, NameAr, NameEn, IsHierarchical, IsActive, SortOrder)
    SELECT N'PARTNER_TYPE', N'أنواع الشركاء', N'Partner Types', 0, 1, COALESCE(MAX(SortOrder), 0) + 1
    FROM dbo.SettingTypes;
    SET @partnerTypeId = SCOPE_IDENTITY();
END;

INSERT INTO dbo.Settings (SettingTypeId, Code, ValueAr, ValueEn, SortOrder, IsActive)
SELECT @partnerTypeId, source.Code, source.ValueAr, source.ValueEn, source.SortOrder, 1
FROM (VALUES
    (N'CLIENT', N'عميل', N'Client', 1),
    (N'SUPPLIER', N'مورد', N'Supplier', 2),
    (N'BOTH', N'عميل ومورد', N'Client & supplier', 3)
) AS source(Code, ValueAr, ValueEn, SortOrder)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Settings existing
    WHERE existing.SettingTypeId = @partnerTypeId AND (existing.Code = source.Code OR existing.ValueAr = source.ValueAr OR existing.ValueEn = source.ValueEn)
);

DECLARE @clientSettingId int = (SELECT TOP 1 SettingId FROM dbo.Settings WHERE SettingTypeId = @partnerTypeId AND (Code = N'CLIENT' OR ValueEn = N'Client') ORDER BY CASE WHEN Code LIKE N'ST-%' THEN 0 ELSE 1 END, SettingId);
DECLARE @supplierSettingId int = (SELECT TOP 1 SettingId FROM dbo.Settings WHERE SettingTypeId = @partnerTypeId AND (Code = N'SUPPLIER' OR ValueEn = N'Supplier') ORDER BY CASE WHEN Code LIKE N'ST-%' THEN 0 ELSE 1 END, SettingId);
DECLARE @bothSettingId int = (SELECT TOP 1 SettingId FROM dbo.Settings WHERE SettingTypeId = @partnerTypeId AND (Code = N'BOTH' OR ValueEn = N'Client & supplier') ORDER BY CASE WHEN Code LIKE N'ST-%' THEN 0 ELSE 1 END, SettingId);
DECLARE @fallbackSettingId int = COALESCE(@clientSettingId, @supplierSettingId, @bothSettingId);

IF COL_LENGTH(N'dbo.Partners', N'PartnerTypeSettingId') IS NULL
    ALTER TABLE dbo.Partners ADD PartnerTypeSettingId int NULL;

EXEC sys.sp_executesql N'
    UPDATE partner
    SET PartnerTypeSettingId = CASE partner.PartnerTypeCode
        WHEN N''CLIENT'' THEN @clientSettingId
        WHEN N''SUPPLIER'' THEN @supplierSettingId
        WHEN N''BOTH'' THEN @bothSettingId
        ELSE @fallbackSettingId
    END
    FROM dbo.Partners partner
    WHERE partner.PartnerTypeSettingId IS NULL;',
    N'@clientSettingId int, @supplierSettingId int, @bothSettingId int, @fallbackSettingId int',
    @clientSettingId, @supplierSettingId, @bothSettingId, @fallbackSettingId;

EXEC sys.sp_executesql N'UPDATE dbo.Partners SET PartnerTypeSettingId=@fallbackSettingId WHERE PartnerTypeSettingId IS NULL', N'@fallbackSettingId int', @fallbackSettingId;

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Partners_TypeStatus' AND object_id = OBJECT_ID(N'dbo.Partners'))
    DROP INDEX IX_Partners_TypeStatus ON dbo.Partners;
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Partners_Type' AND parent_object_id = OBJECT_ID(N'dbo.Partners'))
    ALTER TABLE dbo.Partners DROP CONSTRAINT CK_Partners_Type;

ALTER TABLE dbo.Partners ALTER COLUMN PartnerTypeSettingId int NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Partners_PartnerTypeSetting')
    ALTER TABLE dbo.Partners ADD CONSTRAINT FK_Partners_PartnerTypeSetting FOREIGN KEY (PartnerTypeSettingId) REFERENCES dbo.Settings(SettingId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Partners_PartnerTypeStatus' AND object_id = OBJECT_ID(N'dbo.Partners'))
    CREATE INDEX IX_Partners_PartnerTypeStatus ON dbo.Partners(PartnerTypeSettingId, Status);

IF COL_LENGTH(N'dbo.Partners', N'PartnerTypeCode') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = N'DF_Partners_PartnerTypeCode' AND parent_object_id = OBJECT_ID(N'dbo.Partners'))
        ALTER TABLE dbo.Partners DROP CONSTRAINT DF_Partners_PartnerTypeCode;
    ALTER TABLE dbo.Partners DROP COLUMN PartnerTypeCode;
END;
