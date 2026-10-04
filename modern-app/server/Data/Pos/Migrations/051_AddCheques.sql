-- Received and issued cheques. A cheque is created by a receipt or payment voucher paid by cheque; the voucher posts
-- the partner against cheques under collection (1250) or cheques payable (2150), and the bank treasury is only hit
-- when the cheque clears. Every status change is kept in ChequeEvents with its business date, user and time.
IF OBJECT_ID(N'dbo.Cheques', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Cheques (
        ChequeId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Cheques PRIMARY KEY,
        BranchId int NOT NULL,
        Direction nvarchar(3) NOT NULL,
        ChequeNo nvarchar(50) NOT NULL,
        DueDate date NOT NULL,
        PartnerId int NOT NULL,
        TreasuryId int NOT NULL,
        CurrencyId int NOT NULL,
        Amount decimal(19,4) NOT NULL,
        PartnerCurrencyId int NOT NULL,
        PartnerAmount decimal(19,4) NOT NULL,
        ExchangeRate decimal(19,8) NOT NULL,
        VoucherNo nvarchar(50) NOT NULL,
        VoucherMoveNo int NOT NULL,
        VoucherDate date NOT NULL,
        Description nvarchar(250) NULL,
        Status nvarchar(20) NOT NULL CONSTRAINT DF_Cheques_Status DEFAULT N'PENDING',
        StatusDate date NULL,
        StatusBy int NULL,
        StatusAt datetime2(3) NULL,
        SavedBy int NULL,
        CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Cheques_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Cheques_Branch FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
        CONSTRAINT FK_Cheques_Partner FOREIGN KEY (PartnerId) REFERENCES dbo.Partners(PartnerId),
        CONSTRAINT FK_Cheques_Treasury FOREIGN KEY (TreasuryId) REFERENCES dbo.Treasuries(TreasuryId),
        CONSTRAINT FK_Cheques_Currency FOREIGN KEY (CurrencyId) REFERENCES dbo.Currencies(CurrencyId),
        CONSTRAINT FK_Cheques_PartnerCurrency FOREIGN KEY (PartnerCurrencyId) REFERENCES dbo.Currencies(CurrencyId),
        CONSTRAINT FK_Cheques_StatusBy FOREIGN KEY (StatusBy) REFERENCES dbo.Users(UserId),
        CONSTRAINT FK_Cheques_SavedBy FOREIGN KEY (SavedBy) REFERENCES dbo.Users(UserId),
        CONSTRAINT CK_Cheques_Direction CHECK (Direction IN (N'IN',N'OUT')),
        CONSTRAINT CK_Cheques_Status CHECK (Status IN (N'PENDING',N'DEPOSITED',N'CLEARED',N'BOUNCED',N'RETURNED',N'CANCELLED')),
        CONSTRAINT CK_Cheques_DirectionStatus CHECK (NOT (Direction=N'IN' AND Status=N'CANCELLED') AND NOT (Direction=N'OUT' AND Status IN (N'DEPOSITED',N'RETURNED'))),
        CONSTRAINT CK_Cheques_Amounts CHECK (Amount > 0 AND PartnerAmount > 0 AND ExchangeRate > 0),
        CONSTRAINT UQ_Cheques_BranchVoucher UNIQUE (BranchId, VoucherNo)
    );
    CREATE INDEX IX_Cheques_BranchStatusDue ON dbo.Cheques(BranchId, Status, DueDate);
    CREATE INDEX IX_Cheques_Number ON dbo.Cheques(Direction, TreasuryId, ChequeNo);
    CREATE INDEX IX_Cheques_VoucherMove ON dbo.Cheques(VoucherMoveNo);
END;
IF OBJECT_ID(N'dbo.ChequeEvents', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ChequeEvents (
        ChequeEventId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ChequeEvents PRIMARY KEY,
        ChequeId int NOT NULL,
        FromStatus nvarchar(20) NULL,
        ToStatus nvarchar(20) NOT NULL,
        EventDate date NOT NULL,
        MoveNo int NULL,
        TreasuryId int NULL,
        Note nvarchar(250) NULL,
        SavedBy int NULL,
        SavedAt datetime2(3) NOT NULL CONSTRAINT DF_ChequeEvents_SavedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_ChequeEvents_Cheque FOREIGN KEY (ChequeId) REFERENCES dbo.Cheques(ChequeId),
        CONSTRAINT FK_ChequeEvents_Treasury FOREIGN KEY (TreasuryId) REFERENCES dbo.Treasuries(TreasuryId),
        CONSTRAINT FK_ChequeEvents_User FOREIGN KEY (SavedBy) REFERENCES dbo.Users(UserId)
    );
    CREATE INDEX IX_ChequeEvents_Cheque ON dbo.ChequeEvents(ChequeId, ChequeEventId);
END;

-- Holding accounts for cheques that are recorded but not yet cleared, in every branch that has a chart of accounts:
-- cheques under collection under trade debtors (1200) and cheques payable under trade creditors (2100).
INSERT INTO dbo.Accounts(BranchId,AccountCode,NameAr,NameEn,AccountType,ParentAccountId)
SELECT parent.BranchId,v.Code,v.NameAr,v.NameEn,v.AccountType,parent.AccountId
FROM (VALUES
    (N'1250',N'شيكات برسم التحصيل',N'Cheques under collection',N'ASSET',N'1200'),
    (N'2150',N'شيكات مستحقة الدفع',N'Cheques payable',N'LIABILITY',N'2100')
) v(Code,NameAr,NameEn,AccountType,ParentCode)
JOIN dbo.Accounts parent ON parent.AccountCode=v.ParentCode
WHERE NOT EXISTS (SELECT 1 FROM dbo.Accounts a WHERE a.BranchId=parent.BranchId AND a.AccountCode=v.Code);

-- Clearing, bouncing, returning and cancelling cheques is its own permission (legacy ChCheques). Recording a cheque
-- voucher stays under TREASURY_MANAGE like any receipt. Roles that already hold USER_MANAGEMENT get it.
IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE Code=N'CHEQUES_MANAGE')
    INSERT INTO dbo.Permissions(Code, Name, Description) VALUES (N'CHEQUES_MANAGE', N'Manage cheques', N'Allows depositing, clearing, bouncing, returning and cancelling received and issued cheques.');
INSERT INTO dbo.RolePermissions(RoleId, PermissionId)
SELECT admin.RoleId, perm.PermissionId
FROM (SELECT DISTINCT rp.RoleId FROM dbo.RolePermissions rp JOIN dbo.Permissions um ON um.PermissionId = rp.PermissionId WHERE um.Code = N'USER_MANAGEMENT') admin
JOIN dbo.Permissions perm ON perm.Code = N'CHEQUES_MANAGE'
WHERE NOT EXISTS (SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId = admin.RoleId AND rp.PermissionId = perm.PermissionId);
