# Settings API

All routes are served by the local .NET API. The React app never accesses the POS database directly. Database commands are parameterized.

| Method and route | Behavior |
|---|---|
| `GET /api/settings/types` | Active types, ordered for the type cards, with aggregated counts of active values. `?includeInactive=true` includes inactive types for administration. Counts are returned in this single query. |
| `POST /api/settings/types` | Creates a SettingType from `NameAr`, `NameEn`, `IsHierarchical`, and optional `IsActive`. Returns generated identity, Code, and SortOrder. |
| `PUT /api/settings/types/{settingTypeId}` | Updates the localized names and editable flags. Code and SortOrder remain unchanged. Rejects switching to flat while any value has a parent. |
| `POST /api/settings/types/{settingTypeId}/activate` | Reactivates a type without changing its Settings. |
| `POST /api/settings/types/{settingTypeId}/deactivate` | Deactivates a type without deleting or deactivating its Settings. |
| `GET /api/settings/types/{typeCode}` | One active type by stable code. |
| `GET /api/settings/types/{typeCode}/items` | Values for a type; optional `search` covers generated Code and both localized values; optional `active`, `parent`, and `roots=true` filters. Omitting `active` returns both states. |
| `GET /api/settings/types/{typeCode}/tree` | Legacy tree-shaped API response remains available, but the approved Settings UI uses the items endpoint and card drill-down. |
| `POST /api/settings/types/{typeCode}/items` | Creates a value and returns its generated ID, Code, and SortOrder. |
| `PUT /api/settings/items/{settingId}` | Updates localized values, parent, and active state. Existing Code is stable; SortOrder is preserved unless the row moves to a different parent. |
| `POST /api/settings/items/{settingId}/activate` | Activates a value. |
| `POST /api/settings/items/{settingId}/deactivate` | Deactivates a value if it has no active descendants. Descendants are never silently deactivated. |

Create/update request DTOs accept only `ValueAr`, `ValueEn`, `ParentSettingId`, and `IsActive`. Code, SortOrder, and Icon are not writable fields. Both localized values are required and limited to 200 characters. Flat types reject parents. A hierarchical parent must exist in the same type. Updates reject self-parenting, cycles, and moves below descendants. The SQL composite foreign key independently enforces same-type parent integrity. Invalid hierarchy returns 400; unique-code conflicts return 409. Physical deletion is not exposed.

SettingType create/update requests accept only `NameAr`, `NameEn`, `IsHierarchical`, and `IsActive`. The client cannot provide SettingTypeId, Code, or SortOrder. Creating a user-defined type uses a serializable transaction and a table lock while appending SortOrder; a temporary unique pending code is replaced inside the same transaction with `TYPE-{SettingTypeId:D6}` after SQL Server returns the identity. This does not depend on localized names and remains stable on rename. Existing system codes `UNIT`, `ITEM_CATEGORY`, and `LOCATION` are unchanged. The type Code unique constraint is the final duplicate guard. Type deactivation is explicit and non-cascading. Changing a type to flat is rejected if any setting in it has a non-root parent; the check is performed by the backend in the update transaction. No database migration was needed for type administration.

Create operations use a SQL Server serializable transaction. The identity insert provides the permanent `SettingId`; within the same transaction the service assigns `ST-` plus the zero-padded identity and saves Code before commit. A locked uniqueness check adds a deterministic suffix only if a legacy/manual code already occupies the base code. Renaming never changes Code.

SortOrder is assigned inside the same serializable create transaction. An update/range lock on `IX_Settings_Type_Parent` protects the sibling key range while the next order is selected and the row inserted. For reparenting, the destination sibling range is locked and a new destination order is assigned transactionally. This is appropriate for low-volume Settings administration and avoids concurrent duplicate positions from an unlocked `MAX()+1` query.


