-- Import shipments keep their goods in transit until received, and each additional cost names who is owed it:
-- a partner, a treasury that paid it on the spot, or a payable account. A cost removed before receipt is voided
-- with a reversing entry instead of being deleted, and a cancelled shipment keeps its number and its history.
IF COL_LENGTH(N'dbo.Purchases', N'AllocationMethod') IS NULL
    ALTER TABLE dbo.Purchases ADD AllocationMethod nvarchar(10) NOT NULL CONSTRAINT DF_Purchases_AllocationMethod DEFAULT N'VALUE'
        CONSTRAINT CK_Purchases_AllocationMethod CHECK (AllocationMethod IN (N'VALUE',N'QUANTITY'));

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Purchases_Status' AND definition NOT LIKE N'%CANCELLED%')
BEGIN
    ALTER TABLE dbo.Purchases DROP CONSTRAINT CK_Purchases_Status;
    ALTER TABLE dbo.Purchases ADD CONSTRAINT CK_Purchases_Status CHECK (Status IN (N'DRAFT',N'POSTED',N'CANCELLED'));
END;

IF COL_LENGTH(N'dbo.PurchaseAdditionalCosts', N'PayeeType') IS NULL
BEGIN
    ALTER TABLE dbo.PurchaseAdditionalCosts ADD
        PayeeType nvarchar(20) NOT NULL CONSTRAINT DF_PurchaseAdditionalCosts_PayeeType DEFAULT N'PARTNER',
        PayeePartnerId int NULL CONSTRAINT FK_PurchaseAdditionalCosts_Partner REFERENCES dbo.Partners(PartnerId),
        PayeeTreasuryId int NULL CONSTRAINT FK_PurchaseAdditionalCosts_Treasury REFERENCES dbo.Treasuries(TreasuryId),
        PayeeAccountCode nvarchar(30) NULL,
        VoidedAt datetime2(3) NULL;
END;

-- Costs entered before this change were credited to the shipment's supplier.
EXEC(N'
UPDATE k SET PayeeType = N''PARTNER'', PayeePartnerId = p.SupplierPartnerId
FROM dbo.PurchaseAdditionalCosts k JOIN dbo.Purchases p ON p.PurchaseId = k.PurchaseId
WHERE k.PayeePartnerId IS NULL AND k.PayeeTreasuryId IS NULL AND k.PayeeAccountCode IS NULL;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N''CK_PurchaseAdditionalCosts_Payee'')
    ALTER TABLE dbo.PurchaseAdditionalCosts ADD CONSTRAINT CK_PurchaseAdditionalCosts_Payee CHECK (
        (PayeeType = N''PARTNER'' AND PayeePartnerId IS NOT NULL AND PayeeTreasuryId IS NULL AND PayeeAccountCode IS NULL) OR
        (PayeeType = N''TREASURY'' AND PayeeTreasuryId IS NOT NULL AND PayeePartnerId IS NULL AND PayeeAccountCode IS NULL) OR
        (PayeeType = N''ACCOUNT'' AND PayeeAccountCode IS NOT NULL AND PayeePartnerId IS NULL AND PayeeTreasuryId IS NULL));
');

-- Every branch with a chart of accounts gets the goods-in-transit asset and a payable for import costs.
INSERT INTO dbo.Accounts(BranchId,AccountCode,NameAr,NameEn,AccountType)
SELECT b.BranchId, v.Code, v.NameAr, v.NameEn, v.AccountType
FROM (SELECT DISTINCT BranchId FROM dbo.Accounts) b
CROSS JOIN (VALUES
    (N'1350',N'بضاعة بالطريق',N'Goods in transit',N'ASSET'),
    (N'2200',N'مستحقات تكاليف الاستيراد',N'Accrued import costs',N'LIABILITY')
) v(Code,NameAr,NameEn,AccountType)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Accounts a WHERE a.BranchId = b.BranchId AND a.AccountCode = v.Code);
