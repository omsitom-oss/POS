-- A customer sale goes on the customer's account and is settled later with a receipt, so it has no treasury.
-- Its returns are credited back to the customer's account, so they have no treasury either.
-- A walk-in sale (no customer) is still paid at a till and must name one.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.Sales') AND name=N'TreasuryId' AND is_nullable=0)
    ALTER TABLE dbo.Sales ALTER COLUMN TreasuryId int NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.SalesReturns') AND name=N'TreasuryId' AND is_nullable=0)
    ALTER TABLE dbo.SalesReturns ALTER COLUMN TreasuryId int NULL;
IF OBJECT_ID(N'dbo.CK_Sales_WalkInTreasury', N'C') IS NULL
    EXEC(N'ALTER TABLE dbo.Sales ADD CONSTRAINT CK_Sales_WalkInTreasury CHECK (CustomerPartnerId IS NOT NULL OR TreasuryId IS NOT NULL)');
