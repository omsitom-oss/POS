# API authentication, permissions and branch scoping

## Signing in

- `POST /api/auth/login` with `{ identifier, password }` returns the user profile, its permission codes and a bearer `token`.
- Every other `/api` route except `GET /api/health` needs `Authorization: Bearer <token>`. Without it the API answers 401.
- Tokens are random 256-bit values. Only their SHA-256 hash is stored, in `dbo.UserSessions`.
- A session ends after `Auth:SessionIdleMinutes` without a request (default 120) or `Auth:SessionLifetimeMinutes` after login (default 720).
- `POST /api/auth/logout` ends the current session. Deactivating a user, deactivating their branch, resetting or setting their password, or a password change all end the user's other sessions at once.
- After `Auth:MaxFailedLogins` wrong passwords in a row (default 5) the account is locked for `Auth:LockoutMinutes` (default 15) and login answers 429.

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
| (signed in) | Reading reference data: items, partners, settings, locations, currencies, branches, treasuries, banks, company profile, approval policies |
| `USER_MANAGEMENT` | Users, roles and the permission list |
| `SETTINGS_MANAGE` | Changing settings, locations, company profile, currencies, branches, treasuries, banks, approval policies |
| `EXCHANGE_RATES_EDIT` | Changing currency rates |
| `ITEMS_MANAGE`, `PARTNERS_MANAGE` | Creating and editing items, partners |
| `SALES_VIEW`, `SALES_CREATE` | Sales list, posting sales |
| `PURCHASES_VIEW`, `PURCHASES_MANAGE` | Purchases and imports: reading, and drafting, costs, posting, deleting |
| `INVENTORY_VIEW`, `INVENTORY_DISPOSE`, `INVENTORY_APPROVE` | Stock and batches, disposal requests, approving them |
| `TREASURY_VIEW`, `TREASURY_MANAGE` | Receipts, expenses, statements, balances and chart of accounts; recording receipts, payments, expenses, transfers and manual transactions |
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

Not branch-scoped yet: items, partners and treasuries are shared catalogues (their `BranchId` column is always the first branch today), and partner balances are company-wide.
