ALTER TABLE dbo.Users ADD BranchId int NULL, EmployeeId int NULL, MustChangePassword bit NOT NULL CONSTRAINT DF_Users_MustChangePassword DEFAULT (1), LastLoginAt datetime2(3) NULL;

ALTER TABLE dbo.Users ADD CONSTRAINT FK_Users_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId);
CREATE INDEX IX_Users_BranchId ON dbo.Users(BranchId);

-- EmployeeId is intentionally nullable and has no FK until the future Employees table is introduced.
