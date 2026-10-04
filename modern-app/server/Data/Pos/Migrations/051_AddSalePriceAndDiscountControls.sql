-- Selling below or above an item's list price needs SALES_PRICE_OVERRIDE, and an invoice discount is limited
-- by the highest MaxDiscountPercent among the seller's active roles. Administrators (roles holding
-- USER_MANAGEMENT) keep both; other roles start at list price only and no discount until set in Settings > Roles.
IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE Code = N'SALES_PRICE_OVERRIDE')
    INSERT INTO dbo.Permissions(Code, Name, Description)
    VALUES (N'SALES_PRICE_OVERRIDE', N'Change sale prices', N'Allows selling an item at a price other than its list price.');

INSERT INTO dbo.RolePermissions(RoleId, PermissionId)
SELECT admin.RoleId, perm.PermissionId
FROM (SELECT DISTINCT rp.RoleId FROM dbo.RolePermissions rp JOIN dbo.Permissions um ON um.PermissionId = rp.PermissionId WHERE um.Code = N'USER_MANAGEMENT') admin
JOIN dbo.Permissions perm ON perm.Code = N'SALES_PRICE_OVERRIDE'
WHERE NOT EXISTS (SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId = admin.RoleId AND rp.PermissionId = perm.PermissionId);

-- The script runs as one batch, so statements that use the new column are compiled later through EXEC.
IF COL_LENGTH(N'dbo.Roles', N'MaxDiscountPercent') IS NULL
BEGIN
    ALTER TABLE dbo.Roles ADD MaxDiscountPercent decimal(5,2) NOT NULL
        CONSTRAINT DF_Roles_MaxDiscountPercent DEFAULT (0)
        CONSTRAINT CK_Roles_MaxDiscountPercent CHECK (MaxDiscountPercent BETWEEN 0 AND 100);
    EXEC(N'UPDATE r SET MaxDiscountPercent = 100 FROM dbo.Roles r
        WHERE EXISTS (SELECT 1 FROM dbo.RolePermissions rp JOIN dbo.Permissions p ON p.PermissionId = rp.PermissionId WHERE rp.RoleId = r.RoleId AND p.Code = N''USER_MANAGEMENT'')');
END
