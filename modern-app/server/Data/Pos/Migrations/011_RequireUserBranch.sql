DROP INDEX IX_Users_BranchId ON dbo.Users;
ALTER TABLE dbo.Users ALTER COLUMN BranchId int NOT NULL;
CREATE INDEX IX_Users_BranchId ON dbo.Users(BranchId);
