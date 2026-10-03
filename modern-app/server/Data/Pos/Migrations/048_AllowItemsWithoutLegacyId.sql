-- UQ_Items_LegacyItemId allowed only one item without a legacy ID, so on a new database the second item created
-- in the app failed. Keep legacy IDs unique, but only where there is one (as UX_Partners_LegacyPartnerId does).
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = N'UQ_Items_LegacyItemId' AND parent_object_id = OBJECT_ID(N'dbo.Items'))
    ALTER TABLE dbo.Items DROP CONSTRAINT UQ_Items_LegacyItemId;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Items_LegacyItemId' AND object_id = OBJECT_ID(N'dbo.Items'))
    CREATE UNIQUE INDEX UX_Items_LegacyItemId ON dbo.Items(LegacyItemId) WHERE LegacyItemId IS NOT NULL;
