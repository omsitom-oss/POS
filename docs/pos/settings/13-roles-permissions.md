# Roles and permissions

Roles and permissions are managed from the Settings page. A role has a name, active status, and a set of permission records. Users remain separate from this administration screen; user-to-role assignment will be added when authentication and user administration are extended.

Migration `012_AddRolesAndPermissions.sql` creates `Roles`, `Permissions`, `RolePermissions`, and `UserRoles`. Migration `013_AddUserManagementPermission.sql` adds `USER_MANAGEMENT` (`Manage users`) alongside `EXCHANGE_RATES_EDIT` (`Change exchange rates`). The role editor can assign these permissions to a role. API enforcement remains the next integration point for authenticated operator context.

Permissions are not stored in the generic Settings tables and are not represented as arbitrary UI-only flags. Role and permission identifiers are database-managed, while permission codes are stable system identifiers.
