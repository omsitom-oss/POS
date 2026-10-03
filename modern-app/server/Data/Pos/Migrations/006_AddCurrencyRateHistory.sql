CREATE TABLE dbo.CurrencyRateHistory (
    CurrencyRateId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_CurrencyRateHistory PRIMARY KEY,
    CurrencyId int NOT NULL,
    BaseCurrencyId int NOT NULL,
    Rate decimal(19,8) NOT NULL,
    RecordedAt datetime2(3) NOT NULL CONSTRAINT DF_CurrencyRateHistory_RecordedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_CurrencyRateHistory_Currency FOREIGN KEY (CurrencyId) REFERENCES dbo.Currencies(CurrencyId),
    CONSTRAINT FK_CurrencyRateHistory_BaseCurrency FOREIGN KEY (BaseCurrencyId) REFERENCES dbo.Currencies(CurrencyId),
    CONSTRAINT CK_CurrencyRateHistory_DifferentCurrencies CHECK (CurrencyId <> BaseCurrencyId),
    CONSTRAINT CK_CurrencyRateHistory_PositiveRate CHECK (Rate > 0)
);
CREATE INDEX IX_CurrencyRateHistory_Latest ON dbo.CurrencyRateHistory(CurrencyId, BaseCurrencyId, RecordedAt DESC, CurrencyRateId DESC);
