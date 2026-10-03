# Branches

Branches are dedicated POS configuration records. They are not generic `Settings` values because branch scope affects operational routing, invoice numbering, stock, and future workstation assignments.

Migration `008_AddBranches.sql` creates `dbo.Branches` with:

- `BranchId` identity primary key
- stable, backend-generated `BranchCode` (`BR-000001` format)
- bilingual `NameAr` and `NameEn`
- `IsActive` and system-managed `SortOrder`
- UTC `CreatedAt` and `UpdatedAt` timestamps

The API is `GET /api/branches`, `POST /api/branches`, `PUT /api/branches/{id}`, and activate/deactivate actions. The `/settings/BRANCHES` screen uses the shared bilingual administration table and modal form. Codes and ordering are never client-supplied. Workstation mapping and branch permissions remain future dedicated workflows.
