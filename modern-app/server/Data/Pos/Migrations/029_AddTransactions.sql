SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID(N'dbo.Transactions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Transactions (
        TransactionId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Transactions PRIMARY KEY,
        BranchId int NULL,
        TransactionDate date NOT NULL CONSTRAINT DF_Transactions_TransactionDate DEFAULT (CONVERT(date, SYSUTCDATETIME())),
        MoveNo int NOT NULL CONSTRAINT DF_Transactions_MoveNo DEFAULT (0),
        TransactionType nvarchar(50) NOT NULL,
        Pattern nvarchar(50) NULL,
        AccountId nvarchar(50) NOT NULL,
        PartnerId int NULL,
        TreasuryId int NULL,
        RefNo nvarchar(50) NULL,
        Description nvarchar(250) NULL,
        Debit decimal(19,4) NOT NULL CONSTRAINT DF_Transactions_Debit DEFAULT (0),
        Credit decimal(19,4) NOT NULL CONSTRAINT DF_Transactions_Credit DEFAULT (0),
        ForeignDebit decimal(19,4) NOT NULL CONSTRAINT DF_Transactions_ForeignDebit DEFAULT (0),
        ForeignCredit decimal(19,4) NOT NULL CONSTRAINT DF_Transactions_ForeignCredit DEFAULT (0),
        CurrencyId int NOT NULL,
        ExchangeRate decimal(19,8) NOT NULL CONSTRAINT DF_Transactions_ExchangeRate DEFAULT (1),
        SavedBy int NULL,
        SavedOn datetime2(3) NOT NULL CONSTRAINT DF_Transactions_SavedOn DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_Transactions_Amounts CHECK (
            Debit >= 0 AND Credit >= 0 AND ForeignDebit >= 0 AND ForeignCredit >= 0
            AND (Debit = 0 OR Credit = 0)
            AND (ForeignDebit = 0 OR ForeignCredit = 0)
        ),
        CONSTRAINT CK_Transactions_ExchangeRate CHECK (ExchangeRate > 0),
        CONSTRAINT FK_Transactions_Branch FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
        CONSTRAINT FK_Transactions_Partner FOREIGN KEY (PartnerId) REFERENCES dbo.Partners(PartnerId),
        CONSTRAINT FK_Transactions_Treasury FOREIGN KEY (TreasuryId) REFERENCES dbo.Treasuries(TreasuryId),
        CONSTRAINT FK_Transactions_Currency FOREIGN KEY (CurrencyId) REFERENCES dbo.Currencies(CurrencyId),
        CONSTRAINT FK_Transactions_User FOREIGN KEY (SavedBy) REFERENCES dbo.Users(UserId)
    );

END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Transactions') AND name = N'IX_Transactions_DateMove')
    CREATE INDEX IX_Transactions_DateMove ON dbo.Transactions(TransactionDate, MoveNo, TransactionId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Transactions') AND name = N'IX_Transactions_AccountDate')
    CREATE INDEX IX_Transactions_AccountDate ON dbo.Transactions(AccountId, TransactionDate, TransactionId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Transactions') AND name = N'IX_Transactions_PartnerDate')
    CREATE INDEX IX_Transactions_PartnerDate ON dbo.Transactions(PartnerId, TransactionDate, TransactionId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Transactions') AND name = N'IX_Transactions_TreasuryDate')
    CREATE INDEX IX_Transactions_TreasuryDate ON dbo.Transactions(TreasuryId, TransactionDate, TransactionId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Transactions') AND name = N'IX_Transactions_Reference')
    CREATE INDEX IX_Transactions_Reference ON dbo.Transactions(RefNo);
