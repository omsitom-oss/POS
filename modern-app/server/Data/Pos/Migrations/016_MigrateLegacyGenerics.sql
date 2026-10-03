IF NOT EXISTS (SELECT 1 FROM dbo.SettingTypes WHERE Code = N'GENERIC')
BEGIN
    INSERT INTO dbo.SettingTypes (Code, NameAr, NameEn, IsHierarchical, IsActive, SortOrder)
    SELECT N'GENERIC', N'الأسماء العلمية', N'Generics', 0, 1, COALESCE(MAX(SortOrder), 0) + 1
    FROM dbo.SettingTypes;
END;

DECLARE @settingTypeId int = (SELECT SettingTypeId FROM dbo.SettingTypes WHERE Code = N'GENERIC');

INSERT INTO dbo.Settings (SettingTypeId, ParentSettingId, Code, ValueAr, ValueEn, SortOrder, IsActive)
SELECT @settingTypeId, NULL, CONCAT(N'LEGACY-GEN-', RIGHT(CONCAT(N'000000', CONVERT(nvarchar(20), source.GenericID)), 6)), source.GenericName, source.GenericName,
       ROW_NUMBER() OVER (ORDER BY source.GenericID), 1
FROM [Hsain-Default].dbo.SettingsGenerics AS source
WHERE source.GenericID <> 0
  AND NULLIF(LTRIM(RTRIM(source.GenericName)), N'') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM dbo.Settings AS existing
      WHERE existing.SettingTypeId = @settingTypeId
        AND existing.Code = CONCAT(N'LEGACY-GEN-', RIGHT(CONCAT(N'000000', CONVERT(nvarchar(20), source.GenericID)), 6))
  );
