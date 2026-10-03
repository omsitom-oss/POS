# Settings and permissions

## Connection configuration
`App.config` contains multiple SQL Server connection entries for different machines/environments, including remote SQL Server credentials. The effective active connection is also represented by global connections/configuration in `PublicVariables.vb` and related modules; trace `strConn` assignment at runtime before migration. The supplied local instance connection differs from the checked-in entries. Do not copy credentials into new documentation/configuration; treat the existing file and remote credentials as secrets, rotate any active exposed credentials, and move new secrets to protected local configuration.

## Authentication
`frmULogin` queries `Users` by username, checks `Status = Active`, and compares the stored `UserPass` value to the trimmed entered password in VB. On success it sets global user ID, name, theme, all-branch and big-price flags, applies theme, and closes into the main application. The source shows plaintext comparison and SQL string concatenation; password storage/transport needs careful legacy-compatible migration and a planned credential upgrade.

## Authorization
`frmUsersManagements` and `frmPrivileges` provide user/privilege maintenance. `frmMain.RefreshPrivileges` is invoked after login. Global flags in `PublicVariables.vb` also include pharmacy, finance, branch, request, purchase, disposal and pricing switches. The full privilege table/action mapping and every enforcement point have not yet been confirmed; do not infer security solely from hidden buttons.

## Settings and operator state
Company profile, branches, theme/appearance, insurance configuration, cashier/pharmacy mode, request/finance switches, and user-specific theme/branch rights influence behavior. Capture active configuration values and permission assignments from a sanitized database copy during each form migration. Do not dump usernames, password values, customer data, or financial records into repository documentation.

## Open checks
- Identify the actual connection-string precedence and database-selection UI behavior (F1/F2 visibility in login code suggests legacy database choices; relevant connection change code appears commented).
- Map `Privileges` rows to forms/actions and verify backend checks.
- Determine branch scope for every query and whether users with `AllBranch` can alter current branch.
- Confirm whether the login password field is stored unhashed in active production data.
