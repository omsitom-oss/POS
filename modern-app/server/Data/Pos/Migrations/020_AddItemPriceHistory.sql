CREATE TABLE dbo.ItemPriceHistory (
    ItemPriceHistoryId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ItemPriceHistory PRIMARY KEY,
    ItemId bigint NOT NULL,
    PreviousPrice decimal(19,4) NULL,
    NewPrice decimal(19,4) NOT NULL,
    UserId int NULL,
    ChangedAt datetime2(3) NOT NULL CONSTRAINT DF_ItemPriceHistory_ChangedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_ItemPriceHistory_Item FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_ItemPriceHistory_User FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_ItemPriceHistory_NewPrice_NonNegative CHECK (NewPrice >= 0),
    CONSTRAINT CK_ItemPriceHistory_PreviousPrice_NonNegative CHECK (PreviousPrice IS NULL OR PreviousPrice >= 0)
);

CREATE INDEX IX_ItemPriceHistory_ItemChangedAt ON dbo.ItemPriceHistory(ItemId, ChangedAt DESC, ItemPriceHistoryId DESC);
CREATE INDEX IX_ItemPriceHistory_UserId ON dbo.ItemPriceHistory(UserId);
