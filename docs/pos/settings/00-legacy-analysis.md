# Legacy lookup analysis

Read-only references reviewed: `docs/legacy-analysis/02-forms-inventory.md`, `03-database-schema.md`, `04-database-usage-map.md`, and the corresponding VB forms under `Elite-POS/Modules/Settings/Forms`.

| Legacy form/table | Observed fields and use | Mapping decision |
|---|---|---|
| `frmUnits` / `SettingsUnits` | `UnitID`, `UnitName`; selected by item screens for base and larger units. The form lists, filters, adds, edits, and deletes unit names. | Fits `UNIT` + `Settings`. Modern Arabic/English values are both required. Legacy records are not copied. |
| `frmCategories` / `SettingsCategories` | `CategoryID`, `CategoryName`, `SavedBy`, `SavedOn`; selected on item screens and referenced in insurance exception logic. Legacy categories are flat. | Name is a generic lookup; maps to `ITEM_CATEGORY` + recursive `Settings`. The modern hierarchy is intentional new capability. Audit identity is not carried as a generic setting field. |
| `frmCities` / `SettingsCities` | Only `CityName`; used in customer entry. Available schema inventory shows no primary key. | Fits a future child under `LOCATION`; the historical single-language city list cannot be automatically paired with Arabic/English values. Country/state levels and mapping need deliberate migration decisions. |
| No country form/table found | The analyzed legacy inventory contains `SettingsCities` but no corresponding country lookup. | `LOCATION` supports countries and deeper levels without hard-coded country/city semantics. No locations seeded. |

Other lookup-like data is not automatically generic. `SettingsGenerics` is linked to item and insurance pricing workflows and is pharmacy-oriented; assess it with those workflows. `SettingsInsuranceGroups` participates in insurance contracts, item membership, limits, and copayments, so it belongs in a specialized insurance model. `SettingsSalesMen` includes username/password/status fields and needs a dedicated identity/security design. `SettingsPackages` relates items with quantities and conversion behavior. `SettingsBranches` and branch workstation mapping affect stock and transaction routing. Those concepts need dedicated workflow analysis rather than extra nullable `Settings` columns. `SettingsManufacturers` and insurance company/exception names look name-only in the available schema but are tied to specialized workflows; defer classification until their forms and business use are migrated. Banks/accounts and benefits carry financial meaning and remain dedicated candidates.

No legacy source or database was changed, and no legacy values were migrated.
