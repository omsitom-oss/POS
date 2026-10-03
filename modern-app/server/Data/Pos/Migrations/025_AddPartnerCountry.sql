IF COL_LENGTH(N'dbo.Partners', N'Country') IS NULL
BEGIN
    ALTER TABLE dbo.Partners ADD Country nvarchar(100) NULL;
END;
