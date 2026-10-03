# Settings interface

`/settings` loads SettingTypes and displays active types as compact responsive cards. Each card uses a localized name/description, a monochrome presentation icon, and an active value count returned by the aggregate type endpoint. The frontend supplies descriptions for known types; the schema does not store UI descriptions. The page header has a shared Primary `Add Setting Type` action. Administrators can show inactive types and use each card's compact action menu to edit or deactivate/reactivate it. Card navigation opens the type values; the action menu is separate from the main card click target.

SettingType Add/Edit uses the shared centered modal with Arabic Name, English Name, Hierarchical, and Active controls. Code and SortOrder are system-managed and never editable. Deactivation requires confirmation and leaves the type's setting rows untouched. The backend rejects changing a type to flat when parent/child records exist. Ordinary cards show only the name in the active application language; the bilingual modal is the maintenance exception.

Opening a type uses a route such as `/settings/UNIT`. Flat types use DataTable and display Code, Arabic Name, English Name, Status, and icon-only Actions. This bilingual table is an administration exception so operators can check both translations; Arabic cells remain RTL, English cells and generated codes remain LTR. Search includes Code and both stored translations. Show inactive is a shared switch in the DataTable toolbar beside Search and is off initially.

Hierarchical types use card drill-down, never a tree. Routes contain the selected ancestor IDs, for example `/settings/ITEM_CATEGORY/12/19`, supporting browser Back and refresh. Breadcrumbs link to Settings, the type root, and every ancestor. The card grid shows direct children only, with compact icon actions and localized tooltips for editing and activation. Root and child add actions set ParentSettingId from the current route.

Add/Edit use one centered bilingual modal form. Users cannot edit Code, SortOrder, or Icon; Code and sibling SortOrder are assigned by the backend. Parent is read-only for add, while edit can select a valid parent excluding self and descendants. Deactivation is confirmed, does not cascade, and is prevented while active descendants remain.

`SettingSelect` remains the reusable future business-form control keyed by stable `typeCode`. The Settings screen uses POS data through the .NET API; Design Lab samples remain isolated and fake.
