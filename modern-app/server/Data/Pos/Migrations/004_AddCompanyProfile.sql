CREATE TABLE dbo.CompanyProfile (
    CompanyProfileId tinyint NOT NULL CONSTRAINT PK_CompanyProfile PRIMARY KEY CONSTRAINT CK_CompanyProfile_SingleRow CHECK (CompanyProfileId = 1),
    CompanyName nvarchar(250) NOT NULL CONSTRAINT DF_CompanyProfile_CompanyName DEFAULT (N''),
    CompanyAddress nvarchar(350) NOT NULL CONSTRAINT DF_CompanyProfile_CompanyAddress DEFAULT (N''),
    CompanyPhone1 nvarchar(250) NOT NULL CONSTRAINT DF_CompanyProfile_CompanyPhone1 DEFAULT (N''),
    CompanyPhone2 nvarchar(250) NOT NULL CONSTRAINT DF_CompanyProfile_CompanyPhone2 DEFAULT (N''),
    CompanyMobileNo nvarchar(250) NOT NULL CONSTRAINT DF_CompanyProfile_CompanyMobileNo DEFAULT (N''),
    CompanyFax nvarchar(250) NOT NULL CONSTRAINT DF_CompanyProfile_CompanyFax DEFAULT (N''),
    CompanyEmail nvarchar(250) NOT NULL CONSTRAINT DF_CompanyProfile_CompanyEmail DEFAULT (N''),
    CompanyWebsite nvarchar(250) NOT NULL CONSTRAINT DF_CompanyProfile_CompanyWebsite DEFAULT (N''),
    LogoBase64 nvarchar(max) NULL,
    LogoContentType varchar(100) NULL,
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_CompanyProfile_UpdatedAt DEFAULT (SYSUTCDATETIME())
);
INSERT INTO dbo.CompanyProfile (CompanyProfileId) VALUES (1);
