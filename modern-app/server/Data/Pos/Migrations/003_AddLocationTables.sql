CREATE TABLE dbo.Countries (
    CountryId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Countries PRIMARY KEY,
    NameAr nvarchar(150) NOT NULL,
    NameEn nvarchar(150) NOT NULL,
    IsActive bit NOT NULL CONSTRAINT DF_Countries_IsActive DEFAULT (1),
    SortOrder int NOT NULL CONSTRAINT DF_Countries_SortOrder DEFAULT (0),
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Countries_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Countries_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_Countries_SortOrder CHECK (SortOrder >= 0)
);
CREATE TABLE dbo.Cities (
    CityId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Cities PRIMARY KEY,
    CountryId int NOT NULL,
    NameAr nvarchar(150) NOT NULL,
    NameEn nvarchar(150) NOT NULL,
    IsActive bit NOT NULL CONSTRAINT DF_Cities_IsActive DEFAULT (1),
    SortOrder int NOT NULL CONSTRAINT DF_Cities_SortOrder DEFAULT (0),
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Cities_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Cities_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Cities_Countries FOREIGN KEY (CountryId) REFERENCES dbo.Countries(CountryId),
    CONSTRAINT CK_Cities_SortOrder CHECK (SortOrder >= 0)
);
CREATE INDEX IX_Cities_CountryId ON dbo.Cities(CountryId);
CREATE INDEX IX_Countries_SortOrder ON dbo.Countries(SortOrder, CountryId);
CREATE INDEX IX_Cities_Country_SortOrder ON dbo.Cities(CountryId, SortOrder, CityId);
