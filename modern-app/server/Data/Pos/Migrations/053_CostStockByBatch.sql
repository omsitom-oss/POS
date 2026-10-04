-- Stock is costed by batch in the main currency. A purchase brings a batch into stock at its cost after the invoice
-- discount, converted at the invoice rate; everything that later leaves or returns to the batch carries that cost, and
-- a sale line costs the quantity-weighted cost of the batches it took from. This rewrites the costs already stored.

-- Purchases posted directly stored the line price in the invoice currency before the discount.
UPDATE sm SET UnitCost = ROUND(pl.UnitPrice * CASE WHEN p.Total + p.Discount > 0 THEN p.Total / (p.Total + p.Discount) ELSE 1 END * p.ExchangeRateToBase, 4)
FROM dbo.StockMovements sm
JOIN dbo.PurchaseLines pl ON pl.PurchaseLineId = sm.PurchaseLineId
JOIN dbo.Purchases p ON p.PurchaseId = pl.PurchaseId
WHERE sm.PurchaseId IS NOT NULL AND sm.Quantity > 0 AND sm.SaleId IS NULL AND sm.SalesReturnId IS NULL AND sm.PurchaseReturnId IS NULL
  AND p.ReceivedAt IS NULL;

-- Received drafts already stored the main-currency cost but ignored the discount. Where landed costs were added the
-- goods share can no longer be told apart, so those keep their cost.
UPDATE sm SET UnitCost = ROUND(sm.UnitCost * p.Total / (p.Total + p.Discount), 4)
FROM dbo.StockMovements sm
JOIN dbo.Purchases p ON p.PurchaseId = sm.PurchaseId
WHERE sm.PurchaseLineId IS NOT NULL AND sm.Quantity > 0 AND sm.SaleId IS NULL AND sm.SalesReturnId IS NULL AND sm.PurchaseReturnId IS NULL
  AND p.ReceivedAt IS NOT NULL AND p.Discount > 0 AND p.Total + p.Discount > 0
  AND NOT EXISTS (SELECT 1 FROM dbo.PurchaseAdditionalCosts k WHERE k.PurchaseId = p.PurchaseId);

-- Sales, returns, purchase returns and disposals move a batch at that batch's cost.
UPDATE sm SET UnitCost = batch.UnitCost
FROM dbo.StockMovements sm
CROSS APPLY (SELECT TOP 1 pm.UnitCost FROM dbo.StockMovements pm
             WHERE pm.PurchaseLineId = sm.PurchaseLineId AND pm.PurchaseId IS NOT NULL AND pm.Quantity > 0
             ORDER BY pm.StockMovementId) batch
WHERE sm.PurchaseLineId IS NOT NULL
  AND NOT (sm.PurchaseId IS NOT NULL AND sm.Quantity > 0 AND sm.SaleId IS NULL AND sm.SalesReturnId IS NULL AND sm.PurchaseReturnId IS NULL);

-- A sale line costs what its batches cost.
UPDATE sl SET UnitCost = ROUND(c.Cost, 4)
FROM dbo.SaleLines sl
CROSS APPLY (SELECT SUM(-sm.Quantity * sm.UnitCost) / NULLIF(SUM(-sm.Quantity), 0) AS Cost
             FROM dbo.StockMovements sm WHERE sm.SaleLineId = sl.SaleLineId AND sm.SaleId IS NOT NULL) c
WHERE c.Cost IS NOT NULL;

-- Returned stock that found no batch comes back at its sale line's cost, and a return line costs what came back.
UPDATE sm SET UnitCost = sl.UnitCost
FROM dbo.StockMovements sm
JOIN dbo.SaleLines sl ON sl.SaleLineId = sm.SaleLineId
WHERE sm.SalesReturnId IS NOT NULL AND sm.PurchaseLineId IS NULL;

UPDATE rl SET UnitCost = ROUND(c.Cost, 4)
FROM dbo.SalesReturnLines rl
CROSS APPLY (SELECT SUM(sm.Quantity * sm.UnitCost) / NULLIF(SUM(sm.Quantity), 0) AS Cost
             FROM dbo.StockMovements sm WHERE sm.SalesReturnId = rl.SalesReturnId AND sm.SaleLineId = rl.SaleLineId) c
WHERE c.Cost IS NOT NULL;
