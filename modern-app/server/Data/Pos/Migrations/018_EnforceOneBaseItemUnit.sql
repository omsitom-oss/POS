CREATE UNIQUE INDEX UX_ItemUnits_OneBasePerItem ON dbo.ItemUnits(ItemId) WHERE IsBase = 1;
