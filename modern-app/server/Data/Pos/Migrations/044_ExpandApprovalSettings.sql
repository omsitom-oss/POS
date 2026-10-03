IF NOT EXISTS (SELECT 1 FROM dbo.ApprovalSettings WHERE RequestType=N'PURCHASE_RETURN')
    INSERT INTO dbo.ApprovalSettings(RequestType,RequiresApproval) VALUES(N'PURCHASE_RETURN',1);
IF NOT EXISTS (SELECT 1 FROM dbo.ApprovalSettings WHERE RequestType=N'EXPENSE')
    INSERT INTO dbo.ApprovalSettings(RequestType,RequiresApproval) VALUES(N'EXPENSE',1);
IF NOT EXISTS (SELECT 1 FROM dbo.ApprovalSettings WHERE RequestType=N'RECEIPT')
    INSERT INTO dbo.ApprovalSettings(RequestType,RequiresApproval) VALUES(N'RECEIPT',0);
