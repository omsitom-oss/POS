CREATE TABLE dbo.Items (
    ItemId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Items PRIMARY KEY,
    LegacyItemId int NULL,
    ItemCode nvarchar(50) NOT NULL,
    NameAr nvarchar(250) NOT NULL,
    NameEn nvarchar(250) NOT NULL,
    ManufacturerName nvarchar(250) NULL,
    CategorySettingId int NULL,
    GenericSettingId int NULL,
    SellPrice decimal(19,4) NOT NULL CONSTRAINT DF_Items_SellPrice DEFAULT (0),
    MinimumLevelForAlert int NOT NULL CONSTRAINT DF_Items_MinimumLevelForAlert DEFAULT (0),
    IsActive bit NOT NULL CONSTRAINT DF_Items_IsActive DEFAULT (1),
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Items_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Items_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Items_ItemCode UNIQUE (ItemCode),
    CONSTRAINT UQ_Items_LegacyItemId UNIQUE (LegacyItemId),
    CONSTRAINT FK_Items_CategorySetting FOREIGN KEY (CategorySettingId) REFERENCES dbo.Settings(SettingId),
    CONSTRAINT FK_Items_GenericSetting FOREIGN KEY (GenericSettingId) REFERENCES dbo.Settings(SettingId),
    CONSTRAINT CK_Items_SellPrice_NonNegative CHECK (SellPrice >= 0),
    CONSTRAINT CK_Items_MinimumLevel_NonNegative CHECK (MinimumLevelForAlert >= 0)
);

CREATE INDEX IX_Items_CategorySettingId ON dbo.Items(CategorySettingId);
CREATE INDEX IX_Items_GenericSettingId ON dbo.Items(GenericSettingId);
CREATE INDEX IX_Items_NameAr ON dbo.Items(NameAr);
CREATE INDEX IX_Items_NameEn ON dbo.Items(NameEn);

CREATE TABLE dbo.ItemUnits (
    ItemUnitId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ItemUnits PRIMARY KEY,
    ItemId bigint NOT NULL,
    UnitSettingId int NOT NULL,
    ConversionToBase decimal(19,6) NOT NULL,
    IsBase bit NOT NULL CONSTRAINT DF_ItemUnits_IsBase DEFAULT (0),
    SortOrder int NOT NULL CONSTRAINT DF_ItemUnits_SortOrder DEFAULT (0),
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_ItemUnits_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_ItemUnits_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_ItemUnits_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_ItemUnits_UnitSetting FOREIGN KEY (UnitSettingId) REFERENCES dbo.Settings(SettingId),
    CONSTRAINT UQ_ItemUnits_Item_Unit UNIQUE (ItemId, UnitSettingId),
    CONSTRAINT CK_ItemUnits_Conversion_Positive CHECK (ConversionToBase > 0),
    CONSTRAINT CK_ItemUnits_SortOrder_NonNegative CHECK (SortOrder >= 0)
);

CREATE INDEX IX_ItemUnits_ItemId ON dbo.ItemUnits(ItemId, SortOrder);

DECLARE @categoryTypeId int = (SELECT SettingTypeId FROM dbo.SettingTypes WHERE Code = N'ITEM_CATEGORY');
DECLARE @unitTypeId int = (SELECT SettingTypeId FROM dbo.SettingTypes WHERE Code = N'UNIT');
DECLARE @genericTypeId int = (SELECT SettingTypeId FROM dbo.SettingTypes WHERE Code = N'GENERIC');

IF @categoryTypeId IS NULL OR @unitTypeId IS NULL
    THROW 51000, 'Required ITEM_CATEGORY or UNIT setting type is missing.', 1;

INSERT INTO dbo.Settings (SettingTypeId, ParentSettingId, Code, ValueAr, ValueEn, SortOrder, IsActive)
SELECT @categoryTypeId, NULL,
       CONCAT(N'LEGACY-CAT-', RIGHT(CONCAT(N'000000', CONVERT(nvarchar(20), source.CategoryID)), 6)),
       source.CategoryName, source.CategoryName,
       ROW_NUMBER() OVER (ORDER BY source.CategoryID), 1
FROM [Hsain-Default].dbo.SettingsCategories AS source
WHERE NULLIF(LTRIM(RTRIM(source.CategoryName)), N'') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM dbo.Settings AS existing
      WHERE existing.SettingTypeId = @categoryTypeId
        AND existing.Code = CONCAT(N'LEGACY-CAT-', RIGHT(CONCAT(N'000000', CONVERT(nvarchar(20), source.CategoryID)), 6))
  );

INSERT INTO dbo.Settings (SettingTypeId, ParentSettingId, Code, ValueAr, ValueEn, SortOrder, IsActive)
SELECT @unitTypeId, NULL,
       CONCAT(N'LEGACY-UNIT-', RIGHT(CONCAT(N'000000', CONVERT(nvarchar(20), source.UnitID)), 6)),
       source.UnitName,
       CASE source.UnitName
           WHEN N'علبة' THEN N'Box'
           WHEN N'كيلو' THEN N'Kilogram'
           WHEN N'طن' THEN N'Ton'
           WHEN N'جرام' THEN N'Gram'
           WHEN N'حبة' THEN N'Piece'
           WHEN N'كرتونة' THEN N'Carton'
           WHEN N'طبق' THEN N'Plate'
           WHEN N'جردل' THEN N'Bucket'
           ELSE source.UnitName
       END,
       COALESCE((SELECT MAX(existing.SortOrder) FROM dbo.Settings AS existing WHERE existing.SettingTypeId = @unitTypeId), 0)
         + ROW_NUMBER() OVER (ORDER BY source.UnitID), 1
FROM [Hsain-Default].dbo.SettingsUnits AS source
WHERE NULLIF(LTRIM(RTRIM(source.UnitName)), N'') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM dbo.Settings AS existing
      WHERE existing.SettingTypeId = @unitTypeId
        AND existing.ValueAr = source.UnitName COLLATE DATABASE_DEFAULT
  );

INSERT INTO dbo.Items (LegacyItemId, ItemCode, NameAr, NameEn, ManufacturerName, CategorySettingId, GenericSettingId, SellPrice, MinimumLevelForAlert, IsActive)
SELECT source.ItemID,
       CONCAT(N'ITM-', RIGHT(CONCAT(N'000000', CONVERT(nvarchar(20), source.ItemID)), 6)),
       source.ItemName,
       source.ItemName,
       NULLIF(LTRIM(RTRIM(source.ManufacturerName)), N''),
       categorySetting.SettingId,
       genericSetting.SettingId,
       COALESCE(TRY_CONVERT(decimal(19,4), source.SellPrice), 0),
       CASE WHEN source.MinimumLevelForAlert < 0 THEN 0 ELSE source.MinimumLevelForAlert END,
       1
FROM [Hsain-Default].dbo.SettingsItems AS source
OUTER APPLY (
    SELECT TOP (1) setting.SettingId
    FROM dbo.Settings AS setting
    WHERE setting.SettingTypeId = @categoryTypeId
      AND setting.Code = CONCAT(N'LEGACY-CAT-', RIGHT(CONCAT(N'000000', CONVERT(nvarchar(20), source.CategoryID)), 6))
) AS categorySetting
OUTER APPLY (
    SELECT TOP (1) setting.SettingId
    FROM dbo.Settings AS setting
    WHERE @genericTypeId IS NOT NULL
      AND setting.SettingTypeId = @genericTypeId
      AND setting.Code = CONCAT(N'LEGACY-GEN-', RIGHT(CONCAT(N'000000', CONVERT(nvarchar(20), source.GenericID)), 6))
) AS genericSetting
WHERE NULLIF(LTRIM(RTRIM(source.ItemName)), N'') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.Items AS existing WHERE existing.LegacyItemId = source.ItemID);

INSERT INTO dbo.ItemUnits (ItemId, UnitSettingId, ConversionToBase, IsBase, SortOrder)
SELECT item.ItemId, unitSetting.SettingId, 1, 1, 0
FROM [Hsain-Default].dbo.SettingsItems AS source
JOIN dbo.Items AS item ON item.LegacyItemId = source.ItemID
OUTER APPLY (
    SELECT TOP (1) setting.SettingId
    FROM dbo.Settings AS setting
    WHERE setting.SettingTypeId = @unitTypeId
      AND setting.ValueAr = source.UnitName COLLATE DATABASE_DEFAULT
    ORDER BY CASE WHEN setting.Code = N'ST-000008' THEN 0 ELSE 1 END, setting.SettingId
) AS unitSetting
WHERE NULLIF(LTRIM(RTRIM(source.UnitName)), N'') IS NOT NULL
  AND unitSetting.SettingId IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM dbo.ItemUnits AS existing
      WHERE existing.ItemId = item.ItemId AND existing.UnitSettingId = unitSetting.SettingId
  );

INSERT INTO dbo.ItemUnits (ItemId, UnitSettingId, ConversionToBase, IsBase, SortOrder)
SELECT item.ItemId, unitSetting.SettingId,
       CASE WHEN source.NoOfUnits > 0 THEN CONVERT(decimal(19,6), source.NoOfUnits) ELSE 1 END,
       0, 1
FROM [Hsain-Default].dbo.SettingsItems AS source
JOIN dbo.Items AS item ON item.LegacyItemId = source.ItemID
OUTER APPLY (
    SELECT TOP (1) setting.SettingId
    FROM dbo.Settings AS setting
    WHERE setting.SettingTypeId = @unitTypeId
      AND setting.ValueAr = source.BigUnitName COLLATE DATABASE_DEFAULT
    ORDER BY setting.SettingId
) AS unitSetting
WHERE NULLIF(LTRIM(RTRIM(source.BigUnitName)), N'') IS NOT NULL
  AND NULLIF(LTRIM(RTRIM(source.UnitName)), N'') IS NOT NULL
  AND source.BigUnitName <> source.UnitName
  AND source.NoOfUnits > 1
  AND unitSetting.SettingId IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM dbo.ItemUnits AS existing
      WHERE existing.ItemId = item.ItemId AND existing.UnitSettingId = unitSetting.SettingId
  );
