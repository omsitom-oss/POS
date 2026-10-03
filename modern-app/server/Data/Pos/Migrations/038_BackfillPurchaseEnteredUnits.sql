UPDATE pl
SET OriginalUnitSettingId = pl.UnitSettingId,
    OriginalQuantity = pl.Quantity / NULLIF(iu.ConversionToBase, 0),
    OriginalUnitPrice = pl.UnitPrice * iu.ConversionToBase
FROM dbo.PurchaseLines pl
JOIN dbo.ItemUnits iu ON iu.ItemId = pl.ItemId AND iu.UnitSettingId = pl.UnitSettingId
WHERE pl.OriginalQuantity IS NULL AND iu.IsBase = 0;
