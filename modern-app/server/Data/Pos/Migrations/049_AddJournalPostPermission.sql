-- Manual journal entries (POST /api/transactions) can move money between any accounts, so they get their own
-- permission instead of riding on TREASURY_MANAGE, which 046 gave to every existing role. Roles that already hold
-- USER_MANAGEMENT (administrators) receive it; other roles get it in Settings > Roles.
IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE Code = N'JOURNAL_POST')
    INSERT INTO dbo.Permissions(Code, Name, Description)
    VALUES (N'JOURNAL_POST', N'Post manual journal entries', N'Allows posting manual journal entries between any accounts.');

INSERT INTO dbo.RolePermissions(RoleId, PermissionId)
SELECT admin.RoleId, perm.PermissionId
FROM (SELECT DISTINCT rp.RoleId FROM dbo.RolePermissions rp JOIN dbo.Permissions um ON um.PermissionId = rp.PermissionId WHERE um.Code = N'USER_MANAGEMENT') admin
JOIN dbo.Permissions perm ON perm.Code = N'JOURNAL_POST'
WHERE NOT EXISTS (SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId = admin.RoleId AND rp.PermissionId = perm.PermissionId);
