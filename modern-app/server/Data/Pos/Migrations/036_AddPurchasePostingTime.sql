IF COL_LENGTH(N'dbo.Purchases', N'PostedAt') IS NULL
    ALTER TABLE dbo.Purchases ADD PostedAt datetime2(3) NULL;
IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE Code = N'PURCHASE_RETURN_APPROVE')
    INSERT INTO dbo.Permissions(Code, Name, Description) VALUES (N'PURCHASE_RETURN_APPROVE', N'Approve purchase returns', N'Allows approving purchase return requests after stock availability checks.');
