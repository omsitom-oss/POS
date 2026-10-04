# API authentication, permissions and branch scoping

## Signing in

- `POST /api/auth/login` with `{ identifier, password }` returns the user profile, its permission codes and a bearer `token`.
- Every other `/api` route except `GET /api/health` needs `Authorization: Bearer <token>`. Without it the API answers 401.
- Tokens are random 256-bit values. Only their SHA-256 hash is stored, in `dbo.UserSessions`.
- A session ends after `Auth:SessionIdleMinutes` without a request (default 120) or `Auth:SessionLifetimeMinutes` after login (default 720).
- `POST /api/auth/logout` ends the current session. Deactivating a user, deactivating their branch, resetting or setting their password, or a password change all end the user's other sessions at once.
- After `Auth:MaxFailedLogins` wrong passwords in a row (default 5) the account is locked for `Auth:LockoutMinutes` (default 15). A locked account gets the same 401 as a wrong password, so login never confirms that a user name exists.

Opaque server-side sessions were chosen over JWTs because the service is local with one database: revocation is immediate, permission changes apply on the next request, and there is no signing key to protect.

The frontend stores the login response in `localStorage` and adds the bearer header to every same-origin `/api` call (`frontend/src/app/session.ts`). A 401 sends the user back to the login screen.

## Passwords

- Passwords are PBKDF2-SHA256 with 120,000 iterations and a random salt, at least 8 characters.
- There is no default password. Creating a user without a password, or resetting one, generates a one-time password that the API returns once. The user must change it at first login.
- While a user must change their password, the API only allows `/api/auth/*`; everything else answers 403 with title `PASSWORD_CHANGE_REQUIRED`.
- Changing your own password (`POST /api/auth/change-password`) needs the current password. Setting someone else's (`POST /api/auth/users/{id}/password`) or resetting it (`POST /api/users/{id}/reset-password`) needs `USER_MANAGEMENT`.
- Password changes, resets, user creation, failed logins and lockouts are written to `dbo.SecurityAuditLog`.

## First administrator

On a database with no administrator, create one from the server folder:

```powershell
dotnet run -- --create-admin admin
```

It creates (or reuses) the `Administrators` role with every permission, creates the user in the first active branch, and prints a one-time password.

## Permissions

Each permission code is an authorization policy (`server/Security/PermissionCodes.cs`). Any route without an explicit policy still requires a signed-in user.

| Permission | Allows |
|---|---|
| (signed in) | Reading reference data: items, partners, settings, locations, currencies, banks, company profile, approval policies, and the user's own branch and its treasuries |
| `USER_MANAGEMENT` | Users, roles and the permission list. A change that would leave no active user holding this permission (deactivating the last administrator, their role, or removing the permission) is refused with 409. |
| `SETTINGS_MANAGE` | Changing settings, locations, company profile, currencies, branches, treasuries, banks, approval policies |
| `EXCHANGE_RATES_EDIT` | Changing currency rates |
| `ITEMS_MANAGE`, `PARTNERS_MANAGE` | Creating and editing items, partners |
| `SALES_VIEW`, `SALES_CREATE` | Sales list, posting sales |
| `PURCHASES_VIEW`, `PURCHASES_MANAGE` | Purchases and imports: reading, and drafting, costs, posting, deleting |
| `INVENTORY_VIEW`, `INVENTORY_DISPOSE`, `INVENTORY_APPROVE` | Stock and batches, disposal requests, approving them |
| `TREASURY_VIEW`, `TREASURY_MANAGE` | Receipts, expenses, statements, balances and chart of accounts; recording receipts, payments, expenses and transfers |
| `JOURNAL_POST` | Manual journal entries (`POST /api/transactions`, also needs `TREASURY_VIEW`). They are always stored with type `MANUAL`. Migration 049 gives it to roles that hold `USER_MANAGEMENT`. |
| `CHEQUES_MANAGE` | Depositing, clearing, bouncing, returning and cancelling cheques (`POST /api/cheques/{id}/actions`). Recording a cheque receipt or payment stays under `TREASURY_MANAGE`, and the cheque list under `TREASURY_VIEW`. Migration 050 gives it to roles that hold `USER_MANAGEMENT`. |
| `REPORTS_VIEW` | Report summary |
| `ALL_BRANCHES` | Operational data of other branches |
| `MANAGEMENT_ACCESS` | The central POSManagement customer registry |

Migration 046 adds these codes. So that existing users keep working after the upgrade, every existing role receives the day-to-day permissions and every role that already had `USER_MANAGEMENT` receives all of them. Trim roles afterwards in Settings > Roles.

## Branch scoping

The branch comes from the signed-in user, not from the request:

- Writes (sales, purchases, receipts, expenses, transfers, manual transactions, disposals) use the user's branch. Naming another branch answers 403 unless the user has `ALL_BRANCHES`. `SavedBy`, `RequestedBy` and the disposal reviewer are always the signed-in user.
- List reads (sales, purchases, receipts, expenses, statements, chart of accounts, report summary) return only the user's branch. Users with `ALL_BRANCHES` see every branch, or one branch with `?branchId=`.
- Stock, batches and inventory requests are per branch and default to the user's branch.
- A purchase or disposal request from another branch answers 404.
- Treasuries belong to a branch. The treasury list shows the user's branch only (every branch with `ALL_BRANCHES`). A sale, receipt, payment, expense, transfer or manual transaction can only use treasuries of the document's branch; any other treasury answers 404. Both ends of a transfer must be in the same branch, so moving money between branches is not supported yet.
- New treasuries are created in the user's branch. A user with `ALL_BRANCHES` can pick the branch, or move an existing treasury, in Settings > Treasuries. Users without it can only edit their own branch's treasuries.
- The branch list shows only the user's branch unless they have `ALL_BRANCHES`.

Not branch-scoped yet: items and partners are shared catalogues, and partner balances are company-wide.

## Upgrading an existing install

- Migration 046 gives every existing role the day-to-day permissions, including `TREASURY_MANAGE` and `PURCHASES_MANAGE`. Review every role in Settings > Roles after upgrading and remove what each job does not need. Manual journal entries moved to `JOURNAL_POST` in migration 049, so cashiers no longer get them through `TREASURY_MANAGE`.
- Migration 031 put every existing treasury in the first branch. Until an administrator moves each other branch's tills to that branch in Settings > Treasuries, users of other branches cannot post sales, receipts or expenses.
