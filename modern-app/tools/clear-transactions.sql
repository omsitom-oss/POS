-- Clears every operational document and leaves master data and settings.
-- Keeps: customers/suppliers, items/units/price history, users, roles, branches, treasuries, banks,
--        accounts chart, currencies/rates, settings, locations, company profile, approval policy.
-- Clears: sales, purchases, imports, returns, receipts/payments, expenses, journals, stock movements/batches,
--         inventory requests and document sequences. Stock and all balances end at zero.
-- Run with: sqlcmd -S <server> -E -d <db> -v TargetDb=<db> -i clear_transactions.sql
SET XACT_ABORT ON;
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
IF DB_NAME() <> N'$(TargetDb)'
BEGIN
    RAISERROR(N'Connected database does not match TargetDb; nothing was changed.', 16, 1);
    RETURN;
END;

BEGIN TRANSACTION;
DELETE FROM dbo.StockMovements;
DELETE FROM dbo.InventoryRequests;
DELETE FROM dbo.SalesReturnLines;
DELETE FROM dbo.SalesReturns;
DELETE FROM dbo.PurchaseReturnLines;
DELETE FROM dbo.PurchaseReturns;
DELETE FROM dbo.SaleLines;
DELETE FROM dbo.Sales;
DELETE FROM dbo.PurchaseAdditionalCosts;
DELETE FROM dbo.PurchaseLines;
DELETE FROM dbo.Purchases;
DELETE FROM dbo.Transactions;
DELETE FROM dbo.ReceiptSequences;
DELETE FROM dbo.ExpenseSequences;

-- Start document ids again from 1.
DECLARE @t sysname, @sql nvarchar(400);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR
    SELECT t.name FROM sys.tables t JOIN sys.identity_columns i ON i.object_id = t.object_id
    -- A table that never held a row starts at its seed anyway; reseeding it to 0 would make its first id 0.
    WHERE i.last_value IS NOT NULL AND t.name IN (N'StockMovements', N'InventoryRequests', N'SalesReturnLines', N'SalesReturns', N'PurchaseReturnLines', N'PurchaseReturns',
                     N'SaleLines', N'Sales', N'PurchaseAdditionalCosts', N'PurchaseLines', N'Purchases', N'Transactions');
OPEN c; FETCH NEXT FROM c INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'DBCC CHECKIDENT (N''dbo.' + @t + N''', RESEED, 0) WITH NO_INFOMSGS';
    EXEC (@sql);
    FETCH NEXT FROM c INTO @t;
END;
CLOSE c; DEALLOCATE c;
COMMIT;

SELECT N'Sales' AS TableName, COUNT(*) AS RowsLeft FROM dbo.Sales
UNION ALL SELECT N'Purchases', COUNT(*) FROM dbo.Purchases
UNION ALL SELECT N'Transactions', COUNT(*) FROM dbo.Transactions
UNION ALL SELECT N'StockMovements', COUNT(*) FROM dbo.StockMovements
UNION ALL SELECT N'Partners (kept)', COUNT(*) FROM dbo.Partners
UNION ALL SELECT N'Items (kept)', COUNT(*) FROM dbo.Items;

