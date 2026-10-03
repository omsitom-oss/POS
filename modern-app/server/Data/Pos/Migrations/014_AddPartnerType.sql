IF NOT EXISTS (SELECT 1 FROM dbo.SettingTypes WHERE Code = N'PARTNER_TYPE')
BEGIN
    INSERT INTO dbo.SettingTypes (Code, NameAr, NameEn, IsHierarchical, IsActive, SortOrder)
    SELECT N'PARTNER_TYPE', N'أنواع الشركاء', N'Partner Types', 0, 1, COALESCE(MAX(SortOrder), 0) + 1
    FROM dbo.SettingTypes;
END;
