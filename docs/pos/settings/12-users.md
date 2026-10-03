# Users

Users are dedicated security records, not generic Settings values. They are opened from the main sidebar at `/users`, not from Settings. Migration `009_AddUsers.sql` creates the base account table and `010_UpdateUsersForBranches.sql` adds branch assignment and password-change tracking.

The API is `GET /api/users`, `POST /api/users`, `PUT /api/users/{id}`, and activate/deactivate actions. Passwords are never returned by the API and are never stored in plaintext. New users receive the server-assigned default password `123456` and `MustChangePassword` is set to true; a future authentication flow must require a change after first login. Editing a user only changes the password when a new password is supplied, and setting one resets the flag.

Each user has a required `BranchId` foreign key to `Branches` (`011_RequireUserBranch.sql`). `EmployeeId` is nullable for future employee assignment; its foreign key is intentionally deferred until an Employees table exists. No employee table is created in this phase. The default password is managed server-side and is not displayed in the user form. Permissions are intentionally excluded and will be implemented later as standalone roles and permissions.
