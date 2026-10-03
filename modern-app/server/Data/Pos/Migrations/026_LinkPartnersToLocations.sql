IF COL_LENGTH(N'dbo.Partners', N'CountryId') IS NULL
    ALTER TABLE dbo.Partners ADD CountryId int NULL;
IF COL_LENGTH(N'dbo.Partners', N'CityId') IS NULL
    ALTER TABLE dbo.Partners ADD CityId int NULL;

EXEC sys.sp_executesql N'UPDATE p SET CountryId = c.CountryId FROM dbo.Partners p JOIN dbo.Countries c ON c.NameEn = p.Country OR c.NameAr = p.Country WHERE p.CountryId IS NULL AND p.Country IS NOT NULL';
EXEC sys.sp_executesql N'UPDATE p SET CityId = ci.CityId FROM dbo.Partners p JOIN dbo.Cities ci ON (ci.NameEn = p.City OR ci.NameAr = p.City OR (p.City = N''Umdurman'' AND ci.NameEn = N''Omdurman'')) AND ci.CountryId = p.CountryId WHERE p.CityId IS NULL AND p.City IS NOT NULL';

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Partners_Country')
    ALTER TABLE dbo.Partners ADD CONSTRAINT FK_Partners_Country FOREIGN KEY (CountryId) REFERENCES dbo.Countries(CountryId);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Partners_City')
    ALTER TABLE dbo.Partners ADD CONSTRAINT FK_Partners_City FOREIGN KEY (CityId) REFERENCES dbo.Cities(CityId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Partners_Location' AND object_id = OBJECT_ID(N'dbo.Partners'))
    CREATE INDEX IX_Partners_Location ON dbo.Partners(CountryId, CityId);
