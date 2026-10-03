CREATE OR ALTER PROCEDURE dbo.DeletePurchaseByInvoiceNo
    @InvoiceNo nvarchar(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NULLIF(LTRIM(RTRIM(@InvoiceNo)), N'') IS NULL
        THROW 50001, 'Invoice number is required.', 1;

    DECLARE @PurchaseId int;

    SELECT @PurchaseId = p.PurchaseId
    FROM dbo.Purchases AS p
    WHERE p.InvoiceNo = LTRIM(RTRIM(@InvoiceNo));

    IF @PurchaseId IS NULL
        THROW 50002, 'Purchase invoice was not found.', 1;

    BEGIN TRANSACTION;

    DELETE FROM dbo.StockMovements
    WHERE PurchaseId = @PurchaseId;

    DELETE FROM dbo.PurchaseLines
    WHERE PurchaseId = @PurchaseId;

    DELETE FROM dbo.Purchases
    WHERE PurchaseId = @PurchaseId;

    DELETE FROM dbo.Transactions
    WHERE RefNo = LTRIM(RTRIM(@InvoiceNo))
      AND (TransactionType = 'PURCHASE' OR Pattern = 'PURCHASE');

    COMMIT TRANSACTION;

    SELECT
        @PurchaseId AS PurchaseId,
        LTRIM(RTRIM(@InvoiceNo)) AS InvoiceNo,
        CAST(1 AS bit) AS Deleted;
END;
