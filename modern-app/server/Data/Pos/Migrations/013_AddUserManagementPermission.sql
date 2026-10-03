IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE Code = N'USER_MANAGEMENT')
    INSERT INTO dbo.Permissions(Code, Name, Description)
    VALUES (N'USER_MANAGEMENT', N'Manage users', N'Allows creating, editing, activating, and deactivating POS users.');
