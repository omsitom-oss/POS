IF COL_LENGTH(N'dbo.CompanyProfile', N'BusinessType') IS NULL
BEGIN
    ALTER TABLE dbo.CompanyProfile
        ADD BusinessType nvarchar(50) NOT NULL
            CONSTRAINT DF_CompanyProfile_BusinessType DEFAULT (N'');
END;
