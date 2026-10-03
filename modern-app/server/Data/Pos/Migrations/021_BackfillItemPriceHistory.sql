INSERT INTO dbo.ItemPriceHistory (ItemId, PreviousPrice, NewPrice, UserId, ChangedAt)
SELECT item.ItemId, NULL, item.SellPrice, NULL, item.CreatedAt
FROM dbo.Items AS item
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.ItemPriceHistory AS history
    WHERE history.ItemId = item.ItemId
);
