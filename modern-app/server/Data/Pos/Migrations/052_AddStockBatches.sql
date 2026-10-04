-- Batch-level stock. Every stock movement names the purchase line (batch) it moves, and sale and sales-return
-- movements also name their sale line. Sales take stock from the batch that expires first and skip expired batches,
-- and a return goes back to the batch its sale line took from. A batch's stock is the sum of its movements.
IF COL_LENGTH(N'dbo.StockMovements', N'PurchaseLineId') IS NULL
BEGIN
    ALTER TABLE dbo.StockMovements ADD PurchaseLineId bigint NULL;
    ALTER TABLE dbo.StockMovements ADD CONSTRAINT FK_StockMovements_PurchaseLine FOREIGN KEY (PurchaseLineId) REFERENCES dbo.PurchaseLines(PurchaseLineId);
END;
IF COL_LENGTH(N'dbo.StockMovements', N'SaleLineId') IS NULL
BEGIN
    ALTER TABLE dbo.StockMovements ADD SaleLineId bigint NULL;
    ALTER TABLE dbo.StockMovements ADD CONSTRAINT FK_StockMovements_SaleLine FOREIGN KEY (SaleLineId) REFERENCES dbo.SaleLines(SaleLineId);
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.StockMovements') AND name = N'IX_StockMovements_PurchaseLine')
    EXEC(N'CREATE INDEX IX_StockMovements_PurchaseLine ON dbo.StockMovements(PurchaseLineId, PostingStatus) INCLUDE (Quantity)');
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.StockMovements') AND name = N'IX_StockMovements_SaleLine')
    EXEC(N'CREATE INDEX IX_StockMovements_SaleLine ON dbo.StockMovements(SaleLineId) INCLUDE (PurchaseLineId, Quantity)');

-- Backfill existing movements. The new columns only exist once the ALTERs above ran, so the statements below are
-- compiled separately with EXEC. Each document wrote its movements in line order, so a movement and its line are
-- paired by document, item and order.
EXEC(N'
-- Purchases: one movement per purchase line.
WITH moves AS (
    SELECT sm.StockMovementId, sm.PurchaseId, sm.ItemId, ROW_NUMBER() OVER (PARTITION BY sm.PurchaseId, sm.ItemId ORDER BY sm.StockMovementId) AS rn
    FROM dbo.StockMovements sm
    WHERE sm.PurchaseLineId IS NULL AND sm.PurchaseId IS NOT NULL AND sm.Quantity > 0 AND sm.SaleId IS NULL AND sm.SalesReturnId IS NULL AND sm.PurchaseReturnId IS NULL),
lines AS (
    SELECT pl.PurchaseLineId, pl.PurchaseId, pl.ItemId, ROW_NUMBER() OVER (PARTITION BY pl.PurchaseId, pl.ItemId ORDER BY pl.PurchaseLineId) AS rn
    FROM dbo.PurchaseLines pl)
UPDATE sm SET PurchaseLineId = lines.PurchaseLineId
FROM dbo.StockMovements sm
JOIN moves ON moves.StockMovementId = sm.StockMovementId
JOIN lines ON lines.PurchaseId = moves.PurchaseId AND lines.ItemId = moves.ItemId AND lines.rn = moves.rn;

-- Purchase returns: one movement per return line, and the return line names its purchase line.
WITH moves AS (
    SELECT sm.StockMovementId, sm.PurchaseReturnId, sm.ItemId, ROW_NUMBER() OVER (PARTITION BY sm.PurchaseReturnId, sm.ItemId ORDER BY sm.StockMovementId) AS rn
    FROM dbo.StockMovements sm
    WHERE sm.PurchaseLineId IS NULL AND sm.PurchaseReturnId IS NOT NULL),
lines AS (
    SELECT rl.PurchaseLineId, rl.PurchaseReturnId, rl.ItemId, ROW_NUMBER() OVER (PARTITION BY rl.PurchaseReturnId, rl.ItemId ORDER BY rl.PurchaseReturnLineId) AS rn
    FROM dbo.PurchaseReturnLines rl)
UPDATE sm SET PurchaseLineId = lines.PurchaseLineId
FROM dbo.StockMovements sm
JOIN moves ON moves.StockMovementId = sm.StockMovementId
JOIN lines ON lines.PurchaseReturnId = moves.PurchaseReturnId AND lines.ItemId = moves.ItemId AND lines.rn = moves.rn;

-- Disposals: a negative movement carrying only the purchase, paired with the approved disposal requests of that purchase.
WITH moves AS (
    SELECT sm.StockMovementId, sm.PurchaseId, sm.ItemId, ROW_NUMBER() OVER (PARTITION BY sm.PurchaseId, sm.ItemId ORDER BY sm.StockMovementId) AS rn
    FROM dbo.StockMovements sm
    WHERE sm.PurchaseLineId IS NULL AND sm.PurchaseId IS NOT NULL AND sm.Quantity < 0 AND sm.SaleId IS NULL AND sm.SalesReturnId IS NULL AND sm.PurchaseReturnId IS NULL),
requests AS (
    SELECT r.PurchaseLineId, pl.PurchaseId, r.ItemId, ROW_NUMBER() OVER (PARTITION BY pl.PurchaseId, r.ItemId ORDER BY r.ReviewedAt, r.RequestId) AS rn
    FROM dbo.InventoryRequests r JOIN dbo.PurchaseLines pl ON pl.PurchaseLineId = r.PurchaseLineId
    WHERE r.RequestType = N''INVENTORY_DISPOSAL'' AND r.Status = N''APPROVED'')
UPDATE sm SET PurchaseLineId = requests.PurchaseLineId
FROM dbo.StockMovements sm
JOIN moves ON moves.StockMovementId = sm.StockMovementId
JOIN requests ON requests.PurchaseId = moves.PurchaseId AND requests.ItemId = moves.ItemId AND requests.rn = moves.rn;

-- Sales: one movement per sale line.
WITH moves AS (
    SELECT sm.StockMovementId, sm.SaleId, sm.ItemId, ROW_NUMBER() OVER (PARTITION BY sm.SaleId, sm.ItemId ORDER BY sm.StockMovementId) AS rn
    FROM dbo.StockMovements sm
    WHERE sm.SaleLineId IS NULL AND sm.SaleId IS NOT NULL),
lines AS (
    SELECT l.SaleLineId, l.SaleId, l.ItemId, ROW_NUMBER() OVER (PARTITION BY l.SaleId, l.ItemId ORDER BY l.SaleLineId) AS rn
    FROM dbo.SaleLines l)
UPDATE sm SET SaleLineId = lines.SaleLineId
FROM dbo.StockMovements sm
JOIN moves ON moves.StockMovementId = sm.StockMovementId
JOIN lines ON lines.SaleId = moves.SaleId AND lines.ItemId = moves.ItemId AND lines.rn = moves.rn;

-- Sales returns: one movement per return line, and the return line names its sale line.
WITH moves AS (
    SELECT sm.StockMovementId, sm.SalesReturnId, sm.ItemId, ROW_NUMBER() OVER (PARTITION BY sm.SalesReturnId, sm.ItemId ORDER BY sm.StockMovementId) AS rn
    FROM dbo.StockMovements sm
    WHERE sm.SaleLineId IS NULL AND sm.SalesReturnId IS NOT NULL),
lines AS (
    SELECT rl.SaleLineId, rl.SalesReturnId, rl.ItemId, ROW_NUMBER() OVER (PARTITION BY rl.SalesReturnId, rl.ItemId ORDER BY rl.SalesReturnLineId) AS rn
    FROM dbo.SalesReturnLines rl)
UPDATE sm SET SaleLineId = lines.SaleLineId
FROM dbo.StockMovements sm
JOIN moves ON moves.StockMovementId = sm.StockMovementId
JOIN lines ON lines.SalesReturnId = moves.SalesReturnId AND lines.ItemId = moves.ItemId AND lines.rn = moves.rn;
');

-- Past sales and sales returns had no batch. Replay them in order: a sale takes from the batches received before it that
-- still have stock, expiring first (expired ones included, since the sale already happened), and a return goes back to the batches its sale line
-- took from, latest expiry first. A movement is split into one row per batch; any quantity no batch can cover stays
-- on a row without a batch.
EXEC(N'
DECLARE @moveId bigint, @branch int, @item bigint, @qty decimal(19,4), @saleLine bigint;
DECLARE @batch bigint, @take decimal(19,4), @first bit;
DECLARE replay CURSOR LOCAL FAST_FORWARD FOR
    SELECT StockMovementId, BranchId, ItemId, Quantity, SaleLineId FROM dbo.StockMovements
    WHERE PurchaseLineId IS NULL AND (SaleId IS NOT NULL OR SalesReturnId IS NOT NULL) AND PostingStatus = N''POSTED''
    ORDER BY StockMovementId;
OPEN replay;
FETCH NEXT FROM replay INTO @moveId, @branch, @item, @qty, @saleLine;
WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @left decimal(19,4) = ABS(@qty);
    SET @first = 1;
    WHILE @left > 0
    BEGIN
        SET @batch = NULL; SET @take = 0;
        IF @qty < 0
            SELECT TOP 1 @batch = pl.PurchaseLineId, @take = b.Remaining
            FROM dbo.PurchaseLines pl
            JOIN dbo.Purchases p ON p.PurchaseId = pl.PurchaseId
            CROSS APPLY (SELECT COALESCE(SUM(sm.Quantity), 0) AS Remaining FROM dbo.StockMovements sm WHERE sm.PurchaseLineId = pl.PurchaseLineId AND sm.PostingStatus = N''POSTED'') b
            WHERE p.BranchId = @branch AND pl.ItemId = @item AND p.Status = N''POSTED'' AND b.Remaining > 0
              AND EXISTS (SELECT 1 FROM dbo.StockMovements received WHERE received.PurchaseLineId = pl.PurchaseLineId AND received.Quantity > 0 AND received.StockMovementId < @moveId)
            ORDER BY CASE WHEN pl.ExpiryDate IS NULL THEN 1 ELSE 0 END, pl.ExpiryDate, p.PurchaseDate, pl.PurchaseLineId;
        ELSE IF @saleLine IS NOT NULL
            SELECT TOP 1 @batch = t.PurchaseLineId, @take = t.Taken
            FROM (SELECT sm.PurchaseLineId, -SUM(sm.Quantity) AS Taken FROM dbo.StockMovements sm WHERE sm.SaleLineId = @saleLine AND sm.PurchaseLineId IS NOT NULL AND sm.PostingStatus = N''POSTED'' GROUP BY sm.PurchaseLineId) t
            JOIN dbo.PurchaseLines pl ON pl.PurchaseLineId = t.PurchaseLineId
            WHERE t.Taken > 0
            ORDER BY CASE WHEN pl.ExpiryDate IS NULL THEN 0 ELSE 1 END, pl.ExpiryDate DESC, pl.PurchaseLineId DESC;
        IF @batch IS NULL BREAK;
        IF @take > @left SET @take = @left;
        IF @first = 1
        BEGIN
            UPDATE dbo.StockMovements SET PurchaseLineId = @batch, Quantity = SIGN(@qty) * @take WHERE StockMovementId = @moveId;
            SET @first = 0;
        END
        ELSE
            INSERT dbo.StockMovements(BranchId, ItemId, PurchaseId, Quantity, UnitCost, PostingStatus, CreatedAt, SaleId, SalesReturnId, PurchaseReturnId, PurchaseLineId, SaleLineId)
            SELECT BranchId, ItemId, PurchaseId, SIGN(@qty) * @take, UnitCost, PostingStatus, CreatedAt, SaleId, SalesReturnId, PurchaseReturnId, @batch, SaleLineId
            FROM dbo.StockMovements WHERE StockMovementId = @moveId;
        SET @left = @left - @take;
    END;
    IF @left > 0 AND @first = 0
        INSERT dbo.StockMovements(BranchId, ItemId, PurchaseId, Quantity, UnitCost, PostingStatus, CreatedAt, SaleId, SalesReturnId, PurchaseReturnId, PurchaseLineId, SaleLineId)
        SELECT BranchId, ItemId, PurchaseId, SIGN(@qty) * @left, UnitCost, PostingStatus, CreatedAt, SaleId, SalesReturnId, PurchaseReturnId, NULL, SaleLineId
        FROM dbo.StockMovements WHERE StockMovementId = @moveId;
    FETCH NEXT FROM replay INTO @moveId, @branch, @item, @qty, @saleLine;
END;
CLOSE replay;
DEALLOCATE replay;
');
