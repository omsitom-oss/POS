# Generic Settings design

The customer POS database has two generic reference tables. `SettingTypes` defines stable machine codes and localized labels; `Settings` holds localized values and an optional parent. `SettingType.Code` is the programmatic identifier (`UNIT`, `ITEM_CATEGORY`, `LOCATION`), never a display name or numeric ID. Both Arabic and English values live on the same row.

Use this model for small values whose business meaning is essentially a localized name, optional stable code, activation state, system-managed order, and optional hierarchy. Interface icons belong to React navigation/components, not configurable settings data. It is not a universal entity store. Items, customers, suppliers, warehouses, employees/users, transactions, accounts, banks, stock movements, or values with specialized financial/security/transaction rules need dedicated models.

`ITEM_CATEGORY` and `LOCATION` use the same unbounded-depth parent relation and generic ParentSettingId hierarchy, presented as route-backed card drill-down (not a tree UI). `UNIT` is flat. Type metadata is database data; adding a new type does not require a type-specific screen or application build. Actual lookup values are not seeded in this phase.

Settings are deactivated rather than physically deleted so future business records can retain references. The backend validates type hierarchy, parent ownership, duplicate codes, and cycles; SQL additionally enforces same-type parent references and self-parent prohibition.

