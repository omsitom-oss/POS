-- Sales move the cost of the goods sold out of 1300 Inventory into 5050, and sales returns move it back.
-- Added for every branch that already has a chart of accounts.
INSERT INTO dbo.Accounts(BranchId,AccountCode,NameAr,NameEn,AccountType)
SELECT b.BranchId,N'5050',N'تكلفة البضاعة المباعة',N'Cost of goods sold',N'EXPENSE'
FROM (SELECT DISTINCT BranchId FROM dbo.Accounts) b
WHERE NOT EXISTS (SELECT 1 FROM dbo.Accounts a WHERE a.BranchId=b.BranchId AND a.AccountCode=N'5050');
