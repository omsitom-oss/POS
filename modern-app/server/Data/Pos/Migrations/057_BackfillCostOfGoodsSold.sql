-- Sales and sales returns posted before 056 moved no cost out of (or back into) 1300 Inventory. Each one gets its
-- cost-of-goods lines added to its own journal move, at the unit costs saved on its lines. Moves that already
-- carry a 5050 line are skipped, so the script is safe to run more than once.
INSERT INTO dbo.Transactions(BranchId,TransactionDate,MoveNo,TransactionType,Pattern,AccountId,RefNo,Description,Debit,Credit,ForeignDebit,ForeignCredit,CurrencyId,ExchangeRate,SavedBy)
SELECT j.BranchId,j.TransactionDate,j.MoveNo,j.TransactionType,j.Pattern,v.AccountId,j.RefNo,N'Cost of goods (backfilled)',v.Debit,v.Credit,v.Debit,v.Credit,j.CurrencyId,1,NULL
FROM (
    SELECT s.BranchId, s.SaleNo AS RefNo, N'SALE' AS TransactionType, ROUND(SUM(l.Quantity*l.UnitCost),4) AS Cost, 1 AS IsSale
    FROM dbo.Sales s JOIN dbo.SaleLines l ON l.SaleId=s.SaleId
    WHERE s.Status=N'POSTED'
    GROUP BY s.BranchId, s.SaleNo
    UNION ALL
    SELECT r.BranchId, r.ReturnNo, N'SALES_RETURN', ROUND(SUM(l.Quantity*l.UnitCost),4), 0
    FROM dbo.SalesReturns r JOIN dbo.SalesReturnLines l ON l.SalesReturnId=r.SalesReturnId
    WHERE r.Status=N'POSTED'
    GROUP BY r.BranchId, r.ReturnNo
) c
CROSS APPLY (
    SELECT TOP (1) t.BranchId,t.TransactionDate,t.MoveNo,t.TransactionType,t.Pattern,t.RefNo,t.CurrencyId
    FROM dbo.Transactions t
    WHERE t.BranchId=c.BranchId AND t.RefNo=c.RefNo AND t.TransactionType=c.TransactionType
    ORDER BY t.TransactionId
) j
CROSS APPLY (VALUES
    (CASE WHEN c.IsSale=1 THEN N'5050' ELSE N'1300' END, c.Cost, CAST(0 AS decimal(19,4))),
    (CASE WHEN c.IsSale=1 THEN N'1300' ELSE N'5050' END, CAST(0 AS decimal(19,4)), c.Cost)
) v(AccountId,Debit,Credit)
WHERE c.Cost>0
  AND NOT EXISTS (SELECT 1 FROM dbo.Transactions x WHERE x.BranchId=j.BranchId AND x.MoveNo=j.MoveNo AND x.AccountId=N'5050');
