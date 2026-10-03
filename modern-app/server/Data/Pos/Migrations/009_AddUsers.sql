CREATE TABLE dbo.Users (
    UserId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
    UserName nvarchar(100) NOT NULL,
    Email nvarchar(150) NULL,
    Phone nvarchar(50) NULL,
    PasswordHash nvarchar(300) NOT NULL,
    IsActive bit NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT (1),
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Users_UserName UNIQUE (UserName),
    CONSTRAINT CK_Users_UserName_NotBlank CHECK (LEN(LTRIM(RTRIM(UserName))) > 0)
);

CREATE INDEX IX_Users_IsActive_UserName ON dbo.Users(IsActive, UserName);
