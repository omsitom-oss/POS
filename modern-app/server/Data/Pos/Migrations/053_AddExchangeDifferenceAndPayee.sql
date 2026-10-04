-- Realised exchange differences: settling a foreign-currency partner balance at a rate other than the one it was booked at
-- posts the difference to 4900 (gain) or 5900 (loss). Added for every branch that already has a chart of accounts.
INSERT INTO dbo.Accounts(BranchId,AccountCode,NameAr,NameEn,AccountType)
SELECT b.BranchId,v.Code,v.NameAr,v.NameEn,v.AccountType
FROM (SELECT DISTINCT BranchId FROM dbo.Accounts) b
CROSS JOIN (VALUES
    (N'4900',N'أرباح فروق العملة',N'Exchange gains',N'REVENUE'),
    (N'5900',N'خسائر فروق العملة',N'Exchange losses',N'EXPENSE')
) v(Code,NameAr,NameEn,AccountType)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Accounts a WHERE a.BranchId=b.BranchId AND a.AccountCode=v.Code);

-- Who was paid, for money paid from a till to someone with no partner account (a driver, a customs broker).
IF COL_LENGTH(N'dbo.Transactions', N'PayeeName') IS NULL
    ALTER TABLE dbo.Transactions ADD PayeeName nvarchar(150) NULL;
