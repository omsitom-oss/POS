IF OBJECT_ID(N'dbo.CashBoxes', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.Treasuries', N'U') IS NULL
BEGIN
    EXEC sys.sp_rename N'dbo.CashBoxes', N'Treasuries';
    EXEC sys.sp_rename N'dbo.Treasuries.CashBoxId', N'TreasuryId', N'COLUMN';
    EXEC sys.sp_rename N'dbo.Treasuries.CashBoxCode', N'TreasuryCode', N'COLUMN';
END;

IF OBJECT_ID(N'dbo.Treasuries', N'U') IS NOT NULL
BEGIN
    IF OBJECT_ID(N'dbo.PK_CashBoxes', N'PK') IS NOT NULL EXEC sys.sp_rename N'dbo.PK_CashBoxes', N'PK_Treasuries';
    IF OBJECT_ID(N'dbo.UQ_CashBoxes_Code', N'UQ') IS NOT NULL EXEC sys.sp_rename N'dbo.UQ_CashBoxes_Code', N'UQ_Treasuries_Code';
    IF OBJECT_ID(N'dbo.FK_CashBoxes_Currency', N'F') IS NOT NULL EXEC sys.sp_rename N'dbo.FK_CashBoxes_Currency', N'FK_Treasuries_Currency';
    IF OBJECT_ID(N'dbo.FK_CashBoxes_Bank', N'F') IS NOT NULL EXEC sys.sp_rename N'dbo.FK_CashBoxes_Bank', N'FK_Treasuries_Bank';
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Treasuries') AND name=N'IX_CashBoxes_CurrencyActive') EXEC sys.sp_rename N'dbo.Treasuries.IX_CashBoxes_CurrencyActive', N'IX_Treasuries_CurrencyActive', N'INDEX';
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Treasuries') AND name=N'IX_CashBoxes_Bank') EXEC sys.sp_rename N'dbo.Treasuries.IX_CashBoxes_Bank', N'IX_Treasuries_Bank', N'INDEX';
    IF OBJECT_ID(N'dbo.DF_CashBoxes_IsActive', N'D') IS NOT NULL EXEC sys.sp_rename N'dbo.DF_CashBoxes_IsActive', N'DF_Treasuries_IsActive';
    IF OBJECT_ID(N'dbo.DF_CashBoxes_SortOrder', N'D') IS NOT NULL EXEC sys.sp_rename N'dbo.DF_CashBoxes_SortOrder', N'DF_Treasuries_SortOrder';
    IF OBJECT_ID(N'dbo.DF_CashBoxes_CreatedAt', N'D') IS NOT NULL EXEC sys.sp_rename N'dbo.DF_CashBoxes_CreatedAt', N'DF_Treasuries_CreatedAt';
    IF OBJECT_ID(N'dbo.DF_CashBoxes_UpdatedAt', N'D') IS NOT NULL EXEC sys.sp_rename N'dbo.DF_CashBoxes_UpdatedAt', N'DF_Treasuries_UpdatedAt';
    IF OBJECT_ID(N'dbo.DF_CashBoxes_TreasureType', N'D') IS NOT NULL EXEC sys.sp_rename N'dbo.DF_CashBoxes_TreasureType', N'DF_Treasuries_TreasureType';
END;
