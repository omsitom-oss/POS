IF OBJECT_ID(N'dbo.Accounts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Accounts (
        AccountId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Accounts PRIMARY KEY,
        BranchId int NOT NULL,
        AccountCode nvarchar(30) NOT NULL,
        NameAr nvarchar(150) NOT NULL,
        NameEn nvarchar(150) NOT NULL,
        AccountType nvarchar(20) NOT NULL,
        ParentAccountId int NULL,
        IsSystem bit NOT NULL CONSTRAINT DF_Accounts_IsSystem DEFAULT (1),
        IsActive bit NOT NULL CONSTRAINT DF_Accounts_IsActive DEFAULT (1),
        CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Accounts_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Accounts_Branch FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
        CONSTRAINT FK_Accounts_Parent FOREIGN KEY (ParentAccountId) REFERENCES dbo.Accounts(AccountId),
        CONSTRAINT CK_Accounts_Type CHECK (AccountType IN (N'ASSET',N'LIABILITY',N'EQUITY',N'REVENUE',N'EXPENSE')),
        CONSTRAINT UQ_Accounts_BranchCode UNIQUE (BranchId, AccountCode)
    );
    CREATE INDEX IX_Accounts_BranchType ON dbo.Accounts(BranchId, AccountType, AccountCode);
END;

DECLARE @branchId int = (SELECT TOP (1) BranchId FROM dbo.Branches ORDER BY BranchId);
IF @branchId IS NOT NULL
BEGIN
    INSERT INTO dbo.Accounts(BranchId,AccountCode,NameAr,NameEn,AccountType)
    SELECT @branchId,v.Code,v.NameAr,v.NameEn,v.AccountType
    FROM (VALUES
        (N'1000',N'الأصول',N'Assets',N'ASSET'),
        (N'1100',N'الخزائن والبنوك',N'Treasuries and banks',N'ASSET'),
        (N'1200',N'المدينون التجاريون',N'Trade debtors',N'ASSET'),
        (N'1300',N'المخزون',N'Inventory',N'ASSET'),
        (N'2000',N'الالتزامات',N'Liabilities',N'LIABILITY'),
        (N'2100',N'الدائنون التجاريون',N'Trade creditors',N'LIABILITY'),
        (N'3000',N'حقوق الملكية',N'Equity',N'EQUITY'),
        (N'3100',N'رأس المال',N'Capital',N'EQUITY'),
        (N'4000',N'الإيرادات',N'Revenue',N'REVENUE'),
        (N'4100',N'إيرادات المبيعات',N'Sales revenue',N'REVENUE'),
        (N'5000',N'المصروفات',N'Expenses',N'EXPENSE'),
        (N'5100',N'مصروفات التشغيل',N'Operating expenses',N'EXPENSE')
    ) v(Code,NameAr,NameEn,AccountType)
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Accounts a WHERE a.BranchId=@branchId AND a.AccountCode=v.Code);
END;

