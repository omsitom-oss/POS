-- Keep existing values and stable non-empty codes. Normalize only missing/blank codes.
UPDATE dbo.Settings
SET Code = N'ST-' + RIGHT('000000' + CONVERT(varchar(20), SettingId), 6)
WHERE Code IS NULL OR LTRIM(RTRIM(Code)) = N'';

ALTER TABLE dbo.Settings DROP COLUMN Icon;
ALTER TABLE dbo.SettingTypes DROP COLUMN Icon;
