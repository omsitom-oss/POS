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

-- Before journals were kept in the primary currency, a foreign-currency document wrote Debit/Credit in its own currency.
-- Those moves are found by a line outside the primary currency whose Debit/Credit still equal its foreign amount, and
-- every line of the move is scaled to the primary currency: by the purchase's own rate when the move is a purchase,
-- otherwise by the stored rate on or before its date (or the earliest stored rate). Moves with no known rate stay as they are.
DECLARE @primary int = (SELECT TOP (1) CurrencyId FROM dbo.Currencies WHERE IsPrimary=1 AND IsActive=1);
IF @primary IS NOT NULL
BEGIN
    SELECT m.BranchId, m.MoveNo, m.CurrencyId,
        COALESCE(
            (SELECT TOP (1) p.ExchangeRateToBase FROM dbo.Purchases p WHERE p.BranchId=m.BranchId AND p.InvoiceNo=m.RefNo AND p.CurrencyId=m.CurrencyId AND p.ExchangeRateToBase>0),
            (SELECT TOP (1) h.Rate FROM dbo.CurrencyRateHistory h WHERE h.CurrencyId=m.CurrencyId AND h.BaseCurrencyId=@primary AND h.RecordedAt<DATEADD(day,1,CAST(m.TransactionDate AS datetime2)) ORDER BY h.RecordedAt DESC, h.CurrencyRateId DESC),
            (SELECT TOP (1) h.Rate FROM dbo.CurrencyRateHistory h WHERE h.CurrencyId=m.CurrencyId AND h.BaseCurrencyId=@primary ORDER BY h.RecordedAt, h.CurrencyRateId)) AS Rate
    INTO #legacyMoves
    FROM (
        SELECT BranchId, MoveNo, MIN(TransactionDate) AS TransactionDate, MAX(RefNo) AS RefNo, MIN(CurrencyId) AS CurrencyId
        FROM dbo.Transactions
        WHERE CurrencyId<>@primary AND Debit+Credit>0 AND Debit+Credit=ForeignDebit+ForeignCredit
        GROUP BY BranchId, MoveNo
        HAVING MIN(CurrencyId)=MAX(CurrencyId)
    ) m;
    DELETE FROM #legacyMoves WHERE Rate IS NULL OR Rate<=0 OR Rate=1;

    UPDATE t SET Debit=ROUND(t.Debit*m.Rate,4), Credit=ROUND(t.Credit*m.Rate,4)
    FROM dbo.Transactions t JOIN #legacyMoves m ON m.BranchId=t.BranchId AND m.MoveNo=t.MoveNo;

    -- Rounding each line can leave a few ten-thousandths over; the move's largest line absorbs them.
    WITH unbalanced AS (
        SELECT t.BranchId, t.MoveNo, SUM(t.Debit-t.Credit) AS Difference
        FROM dbo.Transactions t JOIN #legacyMoves m ON m.BranchId=t.BranchId AND m.MoveNo=t.MoveNo
        GROUP BY t.BranchId, t.MoveNo HAVING SUM(t.Debit-t.Credit)<>0),
    largest AS (
        SELECT t.TransactionId, o.Difference, ROW_NUMBER() OVER (PARTITION BY t.BranchId, t.MoveNo ORDER BY t.Debit+t.Credit DESC, t.TransactionId) AS Position, CASE WHEN t.Debit>0 THEN 1 ELSE 0 END AS IsDebit
        FROM dbo.Transactions t JOIN unbalanced o ON o.BranchId=t.BranchId AND o.MoveNo=t.MoveNo)
    UPDATE t SET Debit=CASE WHEN l.IsDebit=1 THEN t.Debit-l.Difference ELSE t.Debit END, Credit=CASE WHEN l.IsDebit=0 THEN t.Credit+l.Difference ELSE t.Credit END
    FROM dbo.Transactions t JOIN largest l ON l.TransactionId=t.TransactionId AND l.Position=1;

    DROP TABLE #legacyMoves;
END;
