# Customer POS migration notes

The customer POS migration stream is separate from `Data/Management/Migrations`; it targets `POS`, never `POSManagement` or the legacy database. The explicit `--migrate-pos` command checks `DB_NAME()`, inventories user objects and refuses unexpected objects before applying any migration. Migration scripts run in a SQL Server transaction and record versions in `dbo.PosSchemaMigrations`.

Version 001 (`Data/Pos/Migrations/001_InitialSettings.sql`) created `SettingTypes`, `Settings`, their constraints/indexes and the three required SettingTypes. It remains unchanged.

Version 002 (`Data/Pos/Migrations/002_RemoveSettingIcons.sql`) backfills only null/blank `Settings.Code` values as `ST-` plus the zero-padded identity, then drops `Settings.Icon` and `SettingTypes.Icon`. It does not recreate either table, delete values, alter the seeded type codes, or seed setting values. The pre-migration POS inventory contained only the expected migration history, Settings tables, and one existing Gram value (`SettingId=8`, null Code, `SortOrder=0`). After migration that same row remains, with Code `ST-000008`; its values, status, parent, and order were retained.

New API-created settings get their generated code in the identity insert transaction. Sibling/root SortOrder allocation uses a serializable transaction with an update/range lock on the `(SettingTypeId,ParentSettingId)` index. Migrations do not establish any speculative destination POS tables. No SQLite migration is included or exercised.

Legacy lookup mapping remains in `00-legacy-analysis.md`. Legacy lookup values are not copied in this phase. Future city/category mapping, old IDs, and any business-specific reference data require deliberate migration decisions.
