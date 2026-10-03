IF OBJECT_ID(N'dbo.ExpenseSequences', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ExpenseSequences (
        ExpenseDate date NOT NULL,
        LastNumber int NOT NULL CONSTRAINT DF_ExpenseSequences_LastNumber DEFAULT (0),
        CONSTRAINT PK_ExpenseSequences PRIMARY KEY (ExpenseDate),
        CONSTRAINT CK_ExpenseSequences_Number CHECK (LastNumber >= 0)
    );
END;
