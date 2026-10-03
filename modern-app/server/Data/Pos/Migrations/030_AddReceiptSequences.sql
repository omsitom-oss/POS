IF OBJECT_ID(N'dbo.ReceiptSequences', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ReceiptSequences (
        ReceiptDate date NOT NULL,
        ReceiptType nvarchar(10) NOT NULL,
        LastNumber int NOT NULL CONSTRAINT DF_ReceiptSequences_LastNumber DEFAULT (0),
        CONSTRAINT PK_ReceiptSequences PRIMARY KEY (ReceiptDate, ReceiptType),
        CONSTRAINT CK_ReceiptSequences_Type CHECK (ReceiptType IN (N'RECEIPT', N'PAYMENT')),
        CONSTRAINT CK_ReceiptSequences_Number CHECK (LastNumber >= 0)
    );
END;
