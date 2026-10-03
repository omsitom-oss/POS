# Live database schema analysis

Read-only catalog inspection of `Hsain-Default`. SQL Server metadata lengths are bytes; NVARCHAR/NCHAR lengths below are converted to characters.

Counts: 44 tables; 20 views; 2 procedures; 0 surfaced functions; 0 triggers; 33 PK declarations; 6 FK declarations; 3 user-table non-PK index key columns across 2 indexes.

## Tables and columns

### `Accounts`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `AccountID` | nvarchar(50) | no | no |  |
| `AccountName` | nvarchar(250) | no | no |  |
| `AccountType` | nvarchar(50) | no | no |  |
| `SavedBy` | int | no | no |  |

### `AccountTypes`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `AccountType` | nvarchar(50) | no | no |  |

### `BasicSettings`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `SystemType` | nvarchar(50) | no | no |  |
| `Cashier` | int | yes | no |  |
| `RequestsModule` | int | yes | no |  |
| `InsuranceModule` | int | no | no |  |
| `FinanceModule` | int | no | no |  |
| `CustomesSales` | int | no | no |  |
| `Branches` | int | no | no |  |
| `IsPharmacy` | int | yes | no |  |
| `salemen` | int | yes | no | ((0)) |

### `cash`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `a` | nvarchar(250) | yes | no |  |
| `b` | nvarchar(250) | yes | no |  |
| `cash` | float | no | no |  |

### `Cashier`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `CashierID` | int | no | no |  |
| `Pattern` | nvarchar(250) | no | no |  |
| `SavedOn` | datetime | no | no | (getdate()) |
| `TotalAmount` | float | no | no | ((0)) |
| `PaidAmount` | float | no | no | ((0)) |
| `RemainAmount` | float | no | no | ((0)) |
| `Status` | nvarchar(50) | no | no | (N'') |
| `PaidOn` | datetime | yes | no |  |
| `PaidBy` | int | yes | no |  |

### `Cheques`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `BranchID` | int | yes | no | ((0)) |
| `ChequeID` | int | no | yes |  |
| `ChequeType` | nvarchar(50) | no | no |  |
| `ChequeNo` | nvarchar(50) | no | no |  |
| `ChequeDate` | date | no | no |  |
| `Pattern` | nvarchar(50) | no | no |  |
| `Status` | nvarchar(50) | no | no |  |
| `AccountID` | nvarchar(50) | no | no |  |
| `Amount` | float | no | no |  |
| `WrittenAmount` | nvarchar(250) | no | no |  |
| `SavedBy` | int | no | no |  |
| `SavedOn` | datetime | no | no | (getdate()) |
| `ClearedBy` | int | no | no | ((0)) |
| `ClearedOn` | datetime | yes | no |  |
| `RejectedBy` | int | no | no | ((0)) |
| `RejectedOn` | datetime | yes | no |  |

### `Disposes`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `BranchID` | int | no | no | ((0)) |
| `DisposeID` | int | no | no |  |
| `MoveNo` | int | yes | no |  |
| `DisposeDate` | date | no | no |  |
| `Pattern` | nvarchar(50) | no | no |  |
| `DisposeReason` | nvarchar(500) | no | no |  |
| `Status` | nvarchar(50) | no | no |  |
| `CompanyID` | int | no | no | ((1)) |
| `Total` | float | no | no |  |
| `SavedBy` | bigint | no | no |  |
| `SavedOn` | date | no | no | (getdate()) |
| `ApprovedBy` | int | yes | no | ((0)) |
| `ApprovedOn` | datetime | yes | no |  |
| `UpdatedBy` | bigint | yes | no | ((0)) |
| `UpdatedOn` | date | yes | no |  |

### `InsuranceContracts`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `InsuranceContractID` | int | no | no |  |
| `InsuranceCompanyName` | nvarchar(250) | yes | no |  |
| `BenefitName` | nvarchar(250) | yes | no |  |
| `InsuranceName` | nvarchar(250) | yes | no | ('') |
| `IsPriceList` | int | yes | no |  |
| `Copayment` | float | no | no |  |
| `InvoiceLimit` | float | yes | no |  |
| `InvoiceLimitTreatment` | nvarchar(50) | yes | no |  |
| `ItemLimit` | float | yes | no |  |
| `ItemLimitTreatment` | nvarchar(50) | yes | no |  |
| `Status` | nvarchar(50) | yes | no | (N'Inactive') |
| `SavedBy` | int | no | no |  |
| `SavedOn` | datetime | no | no | (getdate()) |
| `UpdateBy` | nvarchar(250) | no | no | ((0)) |
| `UpdateOn` | datetime | no | no | (getdate()) |

### `InsuranceExceptions`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `InsuranceExceptionID` | int | no | no |  |
| `InsuranceContractID` | int | no | no |  |
| `ExceptionName` | nvarchar(150) | no | no |  |
| `InvoiceLimitExp` | float | no | no | ((0)) |
| `ItemLimitExp` | float | no | no | ((0)) |
| `CopaymentExp` | float | no | no | ((0)) |
| `SavedOn` | date | no | no | (getdate()) |
| `SavedBy` | int | no | no |  |

### `InsuranceExceptionsGroups`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `InsuranceExceptionsGroupID` | int | no | no |  |
| `InsuranceContractID` | int | yes | no |  |
| `InsuranceExceptionID` | int | no | no |  |
| `GroupID` | int | no | no |  |
| `GroupLimit` | float | no | no |  |
| `GroupCopayment` | float | no | no |  |
| `SavedOn` | date | no | no | (getdate()) |
| `SavedBy` | nvarchar(50) | no | no |  |

### `InsuranceGroups`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `InsuranceGroupID` | int | no | no |  |
| `InsuranceContractID` | int | no | no |  |
| `GroupID` | int | no | no |  |
| `GroupLimit` | float | no | no |  |
| `GroupCopayment` | float | no | no |  |
| `SavedOn` | date | no | no | (getdate()) |
| `SavedBy` | nvarchar(50) | no | no |  |

### `InsurancePriceList`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `PriceListID` | int | no | no |  |
| `InsuranceContractID` | int | no | no |  |
| `ItemID` | int | no | no |  |
| `Price` | float | no | no |  |
| `Copayment` | float | no | no |  |
| `Authority` | nvarchar(50) | no | no |  |
| `SavedOn` | date | no | no | (getdate()) |
| `SavedBy` | nvarchar(50) | no | no |  |

### `InsuranceSales`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `InsranceSalesID` | int | no | no |  |
| `BranchID` | int | no | no |  |
| `Pattern` | nvarchar(150) | no | no |  |
| `PatientName` | nvarchar(500) | no | no |  |
| `PatientCardID` | nvarchar(500) | no | no |  |
| `InsuranceID` | int | no | no |  |
| `InsuranceName` | nvarchar(500) | no | no |  |
| `ExceptionID` | int | no | no |  |
| `ExceptionName` | nvarchar(250) | no | no | (N'') |
| `InvoiceLimit` | float | no | no | ((0)) |
| `InvoiceLimitTreatment` | nvarchar(50) | no | no | (N'') |
| `ItemLimit` | float | no | no | ((0)) |
| `ItemLimitTreatment` | nvarchar(50) | no | no | (N'') |
| `Copayment` | float | no | no |  |
| `DiffCoayment` | float | no | no |  |
| `Total` | float | no | no |  |
| `PaidTotal` | float | no | no |  |
| `ApproveID` | int | no | no | ((0)) |
| `Archive` | bit | no | no |  |
| `SavedBy` | int | no | no |  |
| `SavedOn` | date | no | no | (getdate()) |
| `ArchivedBy` | int | yes | no |  |
| `ArchivedOn` | date | yes | no |  |

### `InsuranceSalesTransactions`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `InsranceTransactionID` | int | no | no |  |
| `InsranceSalesID` | int | no | no |  |
| `BranchID` | int | no | no |  |
| `GroupID` | int | no | no |  |
| `Pattern` | nvarchar(150) | no | no |  |
| `ItemID` | int | no | no |  |
| `ItemName` | nvarchar(250) | no | no |  |
| `Quantity` | float | no | no |  |
| `Price` | float | no | no |  |
| `InsuurancePrice` | float | no | no |  |
| `Copayment` | float | no | no |  |
| `DiffCoayment` | float | no | no |  |
| `Total` | float | no | no |  |
| `Note` | nvarchar(250) | no | no |  |
| `Authority` | nvarchar(50) | no | no | (N'') |
| `SavedBy` | int | no | no |  |
| `SavedOn` | datetime | no | no | (getdate()) |

### `InvociesReconciliation`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `InvocieReconciliationID` | int | no | no |  |
| `BranchID` | int | no | no |  |
| `Pattern` | nvarchar(250) | no | no |  |
| `PaymentID` | int | no | no |  |
| `Amount` | float | no | no | ((0)) |
| `SavedBy` | int | no | no |  |
| `SavedOn` | datetime | no | no | (getdate()) |

### `NewTbl`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `SaleID` | int | no | no |  |
| `PartnerID` | int | no | no |  |
| `SalesManName` | nvarchar(250) | no | no | (N'') |

### `OutOfInsuranceItems`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `OutOfInsuranceID` | int | no | no |  |
| `InsuranceContractID` | int | no | no |  |
| `ItemID` | int | no | no |  |
| `SavedBy` | int | no | no |  |
| `Savedon` | date | no | no | (getdate()) |

### `OutOfInsuranceItemsExceptions`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `ItemExceptionID` | int | no | no |  |
| `InsuranceExceptionID` | int | no | no |  |
| `InsuranceContractID` | int | no | no |  |
| `ItemID` | int | no | no |  |
| `SavedOn` | date | yes | no | (getdate()) |
| `SavedBy` | int | yes | no |  |

### `Payments`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `BranchID` | int | no | no | ((0)) |
| `PaymentID` | int | no | no |  |
| `TransactionType` | nvarchar(50) | no | no |  |
| `PaymentType` | nvarchar(50) | no | no |  |
| `Pattern` | nvarchar(50) | no | no |  |
| `MoveNo` | int | no | no |  |
| `PaymentDate` | date | no | no | (getdate()) |
| `PartnerID` | int | no | no |  |
| `AccountID` | nvarchar(150) | no | no |  |
| `Amount` | float | no | no |  |
| `WrittenAmount` | nvarchar(300) | no | no |  |
| `Description` | nvarchar(500) | yes | no |  |
| `AllowReconcilation` | nvarchar(50) | no | no | ('Yes') |
| `SavedBy` | int | yes | no |  |
| `SavedOn` | date | yes | no | (getdate()) |

### `Purchases`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `BranchID` | int | no | no | ((0)) |
| `PurchaseID` | int | no | no |  |
| `MoveNo` | int | yes | no |  |
| `PurchaseDate` | date | no | no |  |
| `Pattern` | nvarchar(50) | no | no |  |
| `Status` | nvarchar(50) | no | no |  |
| `BillNo` | nvarchar(150) | yes | no |  |
| `PartnerID` | int | no | no |  |
| `Total` | float | no | no | ((0)) |
| `Discount` | float | no | no | ((0)) |
| `NetTotal` | float | no | no |  |
| `CompanyID` | int | no | no | ((1)) |
| `SavedBy` | int | no | no |  |
| `SavedOn` | datetime | no | no | (getdate()) |
| `ApprovedBy` | int | yes | no | ((0)) |
| `ApprovedOn` | datetime | yes | no |  |
| `UpdatedBy` | bigint | yes | no | ((0)) |
| `UpdatedOn` | date | yes | no |  |

### `Requests`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `BranchID` | int | no | no | ((0)) |
| `RequestID` | int | no | no |  |
| `MoveNo` | int | yes | no |  |
| `RequestDate` | date | no | no |  |
| `Pattern` | nvarchar(50) | no | no |  |
| `Status` | nvarchar(50) | no | no |  |
| `FromBranch` | int | no | no | ((0)) |
| `ToBranch` | nchar(10) | yes | no |  |
| `PartnerID` | int | yes | no | ((0)) |
| `CompanyID` | int | no | no | ((1)) |
| `Total` | float | no | no | ((0)) |
| `SavedBy` | int | no | no |  |
| `SavedOn` | datetime | no | no | (getdate()) |
| `ApprovedBy` | int | yes | no | ((0)) |
| `ApprovedOn` | datetime | yes | no |  |
| `UpdatedBy` | bigint | yes | no | ((0)) |
| `UpdatedOn` | date | yes | no |  |

### `Sales`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `BranchID` | int | no | no | ((0)) |
| `SaleID` | int | no | no |  |
| `MoveNo` | int | yes | no |  |
| `SaleDate` | date | no | no |  |
| `Pattern` | nvarchar(50) | no | no |  |
| `Status` | nvarchar(50) | no | no |  |
| `PartnerID` | int | no | no |  |
| `SalesManName` | nvarchar(250) | no | no | (N'') |
| `CompanyID` | int | no | no | ((1)) |
| `Total` | float | no | no | ((0)) |
| `Discount` | float | no | no | ((0)) |
| `NetTotal` | float | no | no |  |
| `SavedBy` | int | no | no |  |
| `SavedOn` | datetime | no | no | (getdate()) |
| `ApprovedBy` | int | yes | no | ((0)) |
| `ApprovedOn` | datetime | yes | no | (getdate()) |
| `UpdatedBy` | bigint | yes | no | ((0)) |
| `UpdatedOn` | date | yes | no |  |

### `SettingsBenefits`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `BenefitName` | nvarchar(250) | no | no |  |
| `SavedBy` | int | no | no |  |
| `SavedOn` | datetime | no | no | (getdate()) |

### `SettingsBranches`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `BranchID` | int | no | no |  |
| `BranchName` | nvarchar(250) | no | no |  |
| `BranchCode` | nvarchar(50) | yes | no |  |

### `SettingsBranchesMap`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `MacAddress` | nvarchar(250) | no | no |  |
| `BranchID` | int | no | no |  |
| `SavedOn` | date | no | no | (getdate()) |

### `SettingsCategories`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `CategoryID` | int | no | no |  |
| `CategoryName` | nvarchar(250) | no | no |  |
| `SavedBy` | int | no | no |  |
| `SavedOn` | datetime | no | no | (getdate()) |

### `SettingsCities`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `CityName` | nvarchar(150) | no | no |  |

### `SettingsCompanyProfile`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `CompanyID` | int | no | no |  |
| `CompanyName` | nvarchar(250) | no | no |  |
| `CompanyAddress` | nvarchar(350) | no | no |  |
| `CompanyPhone1` | nvarchar(250) | no | no | (N'') |
| `CompanyPhone2` | nvarchar(250) | no | no | (N'') |
| `CompanyMobileNo` | nvarchar(250) | no | no | (N'') |
| `CompanyFax` | nvarchar(250) | no | no | (N'') |
| `CompanyEmail` | nvarchar(250) | no | no | (N'') |
| `CompanyWebsite` | nvarchar(250) | no | no | (N'') |
| `Logo` | image | yes | no |  |
| `SavedBy` | int | yes | no |  |
| `SavedOn` | datetime | yes | no | (getdate()) |

### `SettingsGenerics`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `GenericID` | int | no | no | ((0)) |
| `GenericName` | nvarchar(250) | no | no |  |
| `SavedBy` | int | no | no |  |
| `SavedOn` | datetime | no | no | (getdate()) |

### `SettingsInsuranceCompanies`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `InsuranceCompanyName` | nvarchar(250) | no | no |  |
| `SavedBy` | int | no | no |  |
| `SavedOn` | datetime | no | no | (getdate()) |

### `SettingsInsuranceExceptions`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `ExceptionName` | nvarchar(250) | no | no |  |
| `SavedBy` | int | no | no |  |
| `SavedOn` | datetime | no | no | (getdate()) |

### `SettingsInsuranceGroups`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `InsuranceGroupID` | int | no | no |  |
| `GroupName` | nvarchar(250) | no | no |  |
| `SavedOn` | date | no | no | (getdate()) |
| `SavedBy` | int | no | no |  |

### `SettingsInsuranceGroupsItems`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `InsuranceGroupItemID` | int | no | no |  |
| `GroupID` | int | no | no |  |
| `ItemID` | int | no | no |  |
| `SavedOn` | date | no | no | (getdate()) |
| `SavedBy` | int | no | no |  |

### `SettingsItems`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `ItemID` | int | no | no |  |
| `ManufacturerName` | nvarchar(250) | yes | no | ('') |
| `CategoryID` | int | yes | no |  |
| `GenericID` | int | yes | no | ((0)) |
| `ItemName` | nvarchar(250) | no | no |  |
| `UnitName` | nvarchar(150) | no | no |  |
| `BigUnitName` | nvarchar(150) | no | no |  |
| `SellPrice` | float | no | no |  |
| `NoOfUnits` | bigint | no | no |  |
| `MinimumLevelForAlert` | int | no | no |  |
| `SavedBy` | int | no | no |  |
| `SavedOn` | datetime | no | no | (getdate()) |
| `UpdatedBy` | int | yes | no |  |
| `UpdatedOn` | datetime | yes | no |  |

### `SettingsManufacturers`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `ManufacturerName` | nvarchar(250) | yes | no |  |
| `SavedBy` | int | yes | no |  |

### `SettingsPackages`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `PackageID` | int | no | no |  |
| `BasicItemID` | int | no | no |  |
| `ItemID` | int | no | no |  |
| `Quantity` | int | no | no | ((1)) |

### `SettingsPartners`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `PartnerID` | int | no | no |  |
| `Client` | int | no | no | ((0)) |
| `Supplier` | int | no | no | ((0)) |
| `PartnerName` | nvarchar(250) | no | no |  |
| `PartnerPhone` | nvarchar(50) | yes | no |  |
| `PartnerCity` | nvarchar(150) | yes | no |  |
| `PartnerAddress` | nvarchar(350) | yes | no |  |
| `PartnerEmail` | nvarchar(150) | yes | no |  |
| `SalesManName` | nvarchar(250) | no | no | (N'') |
| `SavedBy` | int | no | no |  |
| `SavedOn` | datetime | yes | no | (getdate()) |

### `SettingsSalesMen`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `SalesManID` | int | yes | no |  |
| `SalesManName` | nvarchar(250) | no | no |  |
| `UserName` | nvarchar(50) | yes | no |  |
| `Password` | nvarchar(50) | yes | no |  |
| `Status` | nvarchar(50) | yes | no | (N'Active') |

### `SettingsUnits`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `UnitID` | int | no | no |  |
| `UnitName` | nvarchar(150) | no | no |  |

### `Stock`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `BranchID` | int | no | no | ((0)) |
| `Pattern` | nvarchar(250) | no | no |  |
| `StockID` | bigint | no | no |  |
| `StockType` | nvarchar(250) | no | no |  |
| `MoveNo` | bigint | no | no | ((0)) |
| `BarCode` | nvarchar(MAX) | no | no | (N'') |
| `ItemID` | int | no | no |  |
| `PatchID` | bigint | no | no | ((0)) |
| `QuantityIn` | float | no | no | ((0)) |
| `QuantityOut` | float | no | no | ((0)) |
| `BonusIn` | float | no | no | ((0)) |
| `BonusOut` | float | no | no | ((0)) |
| `WholePrice` | float | no | no | ((0)) |
| `SellPrice` | float | no | no | ((0)) |
| `TotalPrice` | float | no | no | ((0)) |
| `ExpiryDate` | date | yes | no |  |
| `StockDate` | date | yes | no | (getdate()) |
| `CompanyID` | int | yes | no | ((1)) |

### `StockQuantities`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `BranchID` | int | no | no |  |
| `ItemID` | int | no | no |  |
| `PatchID` | int | no | no |  |
| `Quantity` | float | no | no |  |
| `ExpiryDate` | date | yes | no |  |

### `TempStocks`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `BranchID` | int | no | no | ((0)) |
| `RefNo` | int | yes | no |  |
| `Pattern` | nvarchar(250) | no | no |  |
| `TempStockID` | bigint | no | yes |  |
| `TempStockType` | nvarchar(250) | no | no |  |
| `BarCode` | nvarchar(MAX) | no | no | (N'') |
| `ItemID` | int | no | no |  |
| `PatchID` | int | yes | no |  |
| `QuantityIn` | float | no | no | ((0)) |
| `QuantityOut` | float | no | no | ((0)) |
| `BonusIn` | float | no | no | ((0)) |
| `BonusOut` | float | no | no | ((0)) |
| `WholePrice` | float | no | no | ((0)) |
| `SellPrice` | float | no | no | ((0)) |
| `TotalPrice` | float | no | no | ((0)) |
| `ExpiryDate` | datetime | yes | no |  |

### `Transactions`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `BranchID` | int | no | no | ((0)) |
| `TransactionID` | int | no | yes |  |
| `TransactionDate` | date | no | no | (getdate()) |
| `MoveNo` | int | no | no |  |
| `TransactionType` | nvarchar(50) | no | no |  |
| `Pattern` | nvarchar(50) | yes | no |  |
| `AccountID` | nvarchar(50) | no | no |  |
| `PartnerID` | int | no | no |  |
| `RefNo` | nvarchar(50) | no | no |  |
| `Description` | nvarchar(250) | no | no |  |
| `Debit` | float | no | no | ((0)) |
| `Credit` | float | no | no | ((0)) |
| `SavedBy` | int | yes | no |  |
| `SavedOn` | date | no | no | (getdate()) |

### `Users`

| Column | Type | Nullable | Identity | Default |
|---|---|---:|---:|---|
| `UserID` | int | no | no |  |
| `UserName` | nvarchar(250) | yes | no |  |
| `UserPass` | nvarchar(250) | yes | no |  |
| `Status` | nvarchar(150) | yes | no | ((1)) |
| `UserEmail` | nvarchar(150) | yes | no |  |
| `UserPhone` | nvarchar(150) | yes | no |  |
| `UserTheme` | int | yes | no | ((0)) |
| `ChMenuConfigrations` | int | yes | no | ((0)) |
| `ChManufacturers` | int | yes | no | ((0)) |
| `ChGenericNames` | int | yes | no | ((0)) |
| `ChCustomers` | int | yes | no | ((0)) |
| `ChCategories` | int | yes | no | ((0)) |
| `ChItems` | int | yes | no | ((0)) |
| `ChCompanyProfile` | int | yes | no | ((0)) |
| `ChMenuRequests` | int | yes | no | ((0)) |
| `ChRequestManagment` | int | yes | no | ((0)) |
| `ChNewRequest` | int | yes | no | ((0)) |
| `ChUpdateRequests` | int | yes | no | ((0)) |
| `ChApprovedRequests` | int | yes | no | ((0)) |
| `ChReturnRequests` | int | yes | no | ((0)) |
| `ChMenuPurchases` | int | yes | no | ((0)) |
| `ChNewPurchases` | int | yes | no | ((0)) |
| `ChUpdatePurchases` | int | yes | no | ((0)) |
| `ChApprovePurchases` | int | yes | no | ((0)) |
| `ChReturnPurchases` | int | yes | no | ((0)) |
| `ChNewPOArchive` | int | yes | no | ((0)) |
| `ChApprovedPOArchive` | int | yes | no | ((0)) |
| `ChMenuSales` | int | yes | no | ((0)) |
| `ChNewSale` | int | yes | no | ((0)) |
| `ChBigPrice` | int | yes | no | ((0)) |
| `ChUpdateSales` | int | yes | no | ((0)) |
| `ChApprovedSales` | int | yes | no | ((0)) |
| `ChReturnSales` | int | yes | no | ((0)) |
| `ChSalesReports` | int | yes | no | ((0)) |
| `ChNewSOArchive` | int | yes | no | ((0)) |
| `ChApprovedSOArchive` | int | yes | no | ((0)) |
| `ChMenuInventory` | int | yes | no | ((0)) |
| `ChInventoryStatus` | int | yes | no | ((0)) |
| `ChInternalGRN` | int | yes | no | ((0)) |
| `ChSalesGRN` | int | yes | no | ((0)) |
| `ChPurchaseGRN` | int | yes | no | ((0)) |
| `ChMenuDispose` | int | yes | no | ((0)) |
| `ChNewDispose` | int | yes | no | ((0)) |
| `ChUpdateDisposes` | int | yes | no | ((0)) |
| `ChApproveDispose` | int | yes | no | ((0)) |
| `ChMenuInsurance` | int | yes | no | ((0)) |
| `ChInsuranceGroup` | int | yes | no | ((0)) |
| `ChInsuranceContracts` | int | yes | no | ((0)) |
| `ChUnits` | int | yes | no | ((0)) |
| `ChPurchaseManagment` | int | yes | no | ((0)) |
| `ChDisposeManagement` | int | yes | no | ((0)) |
| `ChMenuFinance` | int | yes | no | ((0)) |
| `ChPaymentsIn` | int | yes | no | ((0)) |
| `ChCheques` | int | yes | no | ((0)) |
| `ChPaymentsOut` | int | yes | no | ((0)) |
| `chAllBranch` | int | yes | no | ((0)) |
| `ChUsersManagement` | int | yes | no | ((0)) |
| `SavedUserID` | bigint | no | no |  |
| `SavedOn` | datetime | no | no | (getdate()) |
| `UpdatedUserID` | bigint | yes | no |  |
| `UpdatedOn` | datetime | yes | no |  |

## Views

### `dbo.ViewInitialSales`

```sql
CREATE VIEW dbo.ViewInitialSales
AS
SELECT dbo.Sales.SaleID, dbo.Sales.SaleDate, dbo.Sales.Status, dbo.Sales.Pattern, dbo.Sales.PartnerID, dbo.Sales.SavedBy, dbo.SettingsPartners.PartnerName, dbo.Sales.SavedOn
FROM   dbo.Sales INNER JOIN
             dbo.SettingsPartners ON dbo.Sales.PartnerID = dbo.SettingsPartners.PartnerID
WHERE (dbo.Sales.Status = N'جديد')
```

### `dbo.ViewSalesMan`

```sql
CREATE VIEW dbo.ViewSalesMan
AS
SELECT     dbo.Sales.Pattern, dbo.Sales.SalesManName, dbo.Stock.ItemID, dbo.Stock.PatchID, dbo.Stock.QuantityIn, dbo.Stock.QuantityOut, dbo.Stock.BonusIn, dbo.Stock.BonusOut, dbo.Stock.SellPrice, dbo.Stock.WholePrice, dbo.Stock.TotalPrice, dbo.Stock.ExpiryDate, 
                  dbo.Stock.StockDate, dbo.SettingsItems.ItemName, dbo.Stock.StockType, dbo.SettingsPartners.PartnerName, dbo.Sales.PartnerID, dbo.Sales.BranchID
FROM        dbo.Stock INNER JOIN
                  dbo.SettingsItems ON dbo.Stock.ItemID = dbo.SettingsItems.ItemID INNER JOIN
                  dbo.Sales ON dbo.Stock.Pattern = dbo.Sales.Pattern INNER JOIN
                  dbo.SettingsPartners ON dbo.Sales.PartnerID = dbo.SettingsPartners.PartnerID
```

### `dbo.ViewPayments`

```sql
CREATE VIEW [dbo].[ViewPayments]
AS
SELECT        dbo.Payments.BranchID, dbo.Payments.PaymentID, dbo.Payments.TransactionType, dbo.Payments.PaymentType, dbo.Payments.Pattern, dbo.Payments.MoveNo, dbo.Payments.PaymentDate, dbo.Payments.PartnerID, 
                         dbo.Payments.AccountID, dbo.Payments.Amount, dbo.Payments.WrittenAmount, dbo.Payments.Description, dbo.Payments.SavedOn, dbo.Accounts.AccountName, dbo.SettingsPartners.PartnerName, dbo.Payments.SavedBy, 
                         dbo.Users.UserName AS SavedUser
FROM            dbo.Payments INNER JOIN
                         dbo.Accounts ON dbo.Payments.AccountID = dbo.Accounts.AccountID INNER JOIN
                         dbo.SettingsPartners ON dbo.Payments.PartnerID = dbo.SettingsPartners.PartnerID INNER JOIN
                         dbo.Users ON dbo.Payments.SavedBy = dbo.Users.UserID
```

### `dbo.ViewCheques`

```sql
CREATE VIEW [dbo].[ViewCheques]
AS
SELECT        dbo.Cheques.BranchID, dbo.Cheques.ChequeID, dbo.Cheques.Pattern, dbo.ViewPayments.PaymentDate, dbo.Cheques.ChequeNo, dbo.Cheques.ChequeDate, dbo.Cheques.ChequeType, dbo.Cheques.Status, 
                         dbo.ViewPayments.PartnerID, dbo.ViewPayments.PartnerName, dbo.Cheques.AccountID, dbo.Accounts.AccountName, dbo.Cheques.Amount, dbo.Cheques.WrittenAmount, dbo.Cheques.SavedBy, 
                         SavedUsers.UserName AS SavedUser, dbo.Cheques.SavedOn, dbo.Cheques.ClearedBy, ClearedUsers.UserName AS ClearedUser, dbo.Cheques.ClearedOn, dbo.Cheques.RejectedBy, 
                         RejectedUsers.UserName AS RejectedUser, dbo.Cheques.RejectedOn, dbo.SettingsPartners.SalesManName
FROM            dbo.Cheques INNER JOIN
                         dbo.Accounts ON dbo.Cheques.AccountID = dbo.Accounts.AccountID INNER JOIN
                         dbo.Users AS SavedUsers ON dbo.Cheques.SavedBy = SavedUsers.UserID INNER JOIN
                         dbo.Users AS ClearedUsers ON dbo.Cheques.ClearedBy = ClearedUsers.UserID INNER JOIN
                         dbo.Users AS RejectedUsers ON dbo.Cheques.RejectedBy = RejectedUsers.UserID INNER JOIN
                         dbo.ViewPayments ON dbo.Cheques.Pattern = dbo.ViewPayments.Pattern INNER JOIN
                         dbo.SettingsPartners ON dbo.ViewPayments.PartnerID = dbo.SettingsPartners.PartnerID
```

### `dbo.ViewDisposes`

```sql
CREATE VIEW [dbo].[ViewDisposes]
AS
SELECT        dbo.Disposes.BranchID, dbo.SettingsBranches.BranchName, dbo.Disposes.DisposeID, dbo.Disposes.DisposeDate, dbo.Disposes.Pattern, dbo.Disposes.DisposeReason, dbo.Disposes.Status, 
                         dbo.Disposes.Total, dbo.Disposes.SavedBy, SavedUsers.UserName AS SavedUser, dbo.Disposes.SavedOn, dbo.Disposes.ApprovedBy, ApprovedUsers.UserName AS ApprovedUser, dbo.Disposes.ApprovedOn, 
                         dbo.Disposes.UpdatedBy, UpdatedUsers.UserName AS UpdatedUser, dbo.Disposes.UpdatedOn, dbo.Disposes.CompanyID, dbo.SettingsCompanyProfile.CompanyName, 
                         dbo.SettingsCompanyProfile.CompanyAddress, dbo.SettingsCompanyProfile.CompanyPhone1, dbo.SettingsCompanyProfile.CompanyPhone2, dbo.SettingsCompanyProfile.CompanyMobileNo, 
                         dbo.SettingsCompanyProfile.CompanyEmail, dbo.SettingsCompanyProfile.CompanyWebsite, dbo.SettingsCompanyProfile.Logo
FROM            dbo.SettingsCompanyProfile INNER JOIN
                         dbo.Users AS ApprovedUsers INNER JOIN
                         dbo.Disposes ON ApprovedUsers.UserID = dbo.Disposes.ApprovedBy INNER JOIN
                         dbo.Users AS SavedUsers ON dbo.Disposes.SavedBy = SavedUsers.UserID INNER JOIN
                         dbo.Users AS UpdatedUsers ON dbo.Disposes.UpdatedBy = UpdatedUsers.UserID ON dbo.SettingsCompanyProfile.CompanyID = dbo.Disposes.CompanyID INNER JOIN
                         dbo.SettingsBranches ON dbo.Disposes.BranchID = dbo.SettingsBranches.BranchID
```

### `dbo.ViewInsuranceExceptionsGroups`

```sql
CREATE VIEW [dbo].[ViewInsuranceExceptionsGroups]
AS
SELECT        dbo.InsuranceExceptionsGroups.InsuranceExceptionsGroupID, dbo.InsuranceExceptionsGroups.InsuranceExceptionID, dbo.InsuranceExceptionsGroups.GroupID, 
                         dbo.SettingsInsuranceGroups.GroupName, dbo.InsuranceExceptionsGroups.GroupLimit, dbo.InsuranceExceptionsGroups.GroupCopayment, 
                         dbo.InsuranceExceptionsGroups.SavedOn, dbo.InsuranceExceptionsGroups.SavedBy
FROM            dbo.InsuranceExceptionsGroups INNER JOIN
                         dbo.SettingsInsuranceGroups ON dbo.InsuranceExceptionsGroups.GroupID = dbo.SettingsInsuranceGroups.InsuranceGroupID
```

### `dbo.ViewInsuranceGroups`

```sql
CREATE VIEW [dbo].[ViewInsuranceGroups]
AS
SELECT        dbo.InsuranceGroups.InsuranceGroupID, dbo.InsuranceGroups.InsuranceContractID, dbo.SettingsInsuranceGroups.GroupName, dbo.InsuranceGroups.GroupLimit, 
                         dbo.InsuranceGroups.GroupCopayment, dbo.InsuranceGroups.GroupID
FROM            dbo.InsuranceGroups INNER JOIN
                         dbo.SettingsInsuranceGroups ON dbo.InsuranceGroups.GroupID = dbo.SettingsInsuranceGroups.InsuranceGroupID
```

### `dbo.ViewInsuranceGroupsItems`

```sql
CREATE VIEW [dbo].[ViewInsuranceGroupsItems]
AS
SELECT        dbo.InsuranceGroups.InsuranceContractID, dbo.InsuranceGroups.InsuranceGroupID, dbo.InsuranceGroups.GroupID, dbo.SettingsInsuranceGroupsItems.ItemID, 
                         dbo.InsuranceGroups.GroupLimit, dbo.InsuranceGroups.GroupCopayment, dbo.InsuranceContracts.IsPriceList
FROM            dbo.SettingsInsuranceGroupsItems INNER JOIN
                         dbo.InsuranceGroups ON dbo.SettingsInsuranceGroupsItems.GroupID = dbo.InsuranceGroups.GroupID INNER JOIN
                         dbo.InsuranceContracts ON dbo.InsuranceGroups.InsuranceContractID = dbo.InsuranceContracts.InsuranceContractID
```

### `dbo.ViewInsuranceGroupsItemsEXp`

```sql
CREATE VIEW [dbo].[ViewInsuranceGroupsItemsEXp]
AS
SELECT        dbo.InsuranceExceptionsGroups.InsuranceExceptionsGroupID, dbo.InsuranceExceptionsGroups.InsuranceExceptionID, dbo.InsuranceExceptionsGroups.GroupID, 
                         dbo.InsuranceExceptionsGroups.GroupLimit, dbo.InsuranceExceptionsGroups.GroupCopayment, dbo.SettingsInsuranceGroupsItems.ItemID, 
                         dbo.InsuranceExceptions.InsuranceContractID
FROM            dbo.SettingsInsuranceGroupsItems INNER JOIN
                         dbo.InsuranceExceptionsGroups ON dbo.SettingsInsuranceGroupsItems.GroupID = dbo.InsuranceExceptionsGroups.GroupID INNER JOIN
                         dbo.InsuranceExceptions ON dbo.InsuranceExceptionsGroups.InsuranceExceptionID = dbo.InsuranceExceptions.InsuranceExceptionID
```

### `dbo.ViewInsurancePriceList`

```sql
CREATE VIEW [dbo].[ViewInsurancePriceList]
AS
SELECT        dbo.InsurancePriceList.PriceListID, dbo.InsurancePriceList.InsuranceContractID, dbo.InsurancePriceList.Price, dbo.InsurancePriceList.ItemID, dbo.InsurancePriceList.Copayment, dbo.InsurancePriceList.Authority, 
                         dbo.InsurancePriceList.SavedOn, dbo.InsurancePriceList.SavedBy, dbo.InsuranceContracts.InsuranceName, dbo.SettingsItems.ItemName
FROM            dbo.InsurancePriceList INNER JOIN
                         dbo.InsuranceContracts ON dbo.InsurancePriceList.InsuranceContractID = dbo.InsuranceContracts.InsuranceContractID INNER JOIN
                         dbo.SettingsItems ON dbo.InsurancePriceList.ItemID = dbo.SettingsItems.ItemID
```

### `dbo.ViewItems`

```sql
CREATE VIEW [dbo].[ViewItems]
AS
SELECT        dbo.SettingsItems.ItemID, dbo.SettingsItems.ItemName, dbo.SettingsItems.GenericID, dbo.SettingsGenerics.GenericName, dbo.SettingsItems.ManufacturerName, dbo.SettingsItems.CategoryID, 
                         dbo.SettingsCategories.CategoryName, dbo.SettingsItems.UnitName, dbo.SettingsItems.BigUnitName, dbo.SettingsItems.SellPrice, dbo.SettingsItems.NoOfUnits, dbo.SettingsItems.MinimumLevelForAlert
FROM            dbo.SettingsItems INNER JOIN
                         dbo.SettingsCategories ON dbo.SettingsItems.CategoryID = dbo.SettingsCategories.CategoryID INNER JOIN
                         dbo.SettingsGenerics ON dbo.SettingsItems.GenericID = dbo.SettingsGenerics.GenericID
```

### `dbo.ViewOutOfInsuranceItems`

```sql
CREATE VIEW [dbo].[ViewOutOfInsuranceItems]
AS
SELECT        dbo.OutOfInsuranceItems.OutOfInsuranceID, dbo.OutOfInsuranceItems.ItemID, dbo.OutOfInsuranceItems.OutOfInsuranceID AS Expr1, dbo.SettingsItems.ItemName, 
                         dbo.SettingsItems.GenericID, dbo.SettingsGenerics.GenericName, dbo.InsuranceContracts.InsuranceName, dbo.InsuranceContracts.InsuranceCompanyName, 
                         dbo.SettingsItems.CategoryID, dbo.OutOfInsuranceItems.InsuranceContractID, dbo.SettingsCategories.CategoryName
FROM            dbo.OutOfInsuranceItems INNER JOIN
                         dbo.SettingsItems ON dbo.OutOfInsuranceItems.ItemID = dbo.SettingsItems.ItemID INNER JOIN
                         dbo.SettingsGenerics ON dbo.SettingsItems.GenericID = dbo.SettingsGenerics.GenericID INNER JOIN
                         dbo.InsuranceContracts ON dbo.OutOfInsuranceItems.InsuranceContractID = dbo.InsuranceContracts.InsuranceContractID INNER JOIN
                         dbo.SettingsCategories ON dbo.SettingsItems.CategoryID = dbo.SettingsCategories.CategoryID
```

### `dbo.ViewOutOfInsuranceItemsExceptions`

```sql
CREATE VIEW [dbo].[ViewOutOfInsuranceItemsExceptions]
AS
SELECT        dbo.OutOfInsuranceItemsExceptions.ItemExceptionID, dbo.OutOfInsuranceItemsExceptions.InsuranceExceptionID, 
                         dbo.OutOfInsuranceItemsExceptions.InsuranceContractID, dbo.OutOfInsuranceItemsExceptions.ItemID, dbo.SettingsItems.ItemName, 
                         dbo.SettingsGenerics.GenericName, dbo.OutOfInsuranceItemsExceptions.SavedOn, dbo.OutOfInsuranceItemsExceptions.SavedBy, 
                         dbo.SettingsCategories.CategoryName
FROM            dbo.OutOfInsuranceItemsExceptions INNER JOIN
                         dbo.SettingsItems ON dbo.OutOfInsuranceItemsExceptions.ItemID = dbo.SettingsItems.ItemID INNER JOIN
                         dbo.SettingsGenerics ON dbo.SettingsItems.GenericID = dbo.SettingsGenerics.GenericID INNER JOIN
                         dbo.SettingsCategories ON dbo.SettingsItems.CategoryID = dbo.SettingsCategories.CategoryID
```

### `dbo.ViewPackages`

```sql
CREATE VIEW [dbo].[ViewPackages]
AS
SELECT        dbo.SettingsPackages.PackageID, dbo.SettingsPackages.BasicItemID, dbo.SettingsPackages.ItemID, dbo.SettingsItems.ItemName, dbo.SettingsItems.UnitName, 
                         dbo.SettingsPackages.Quantity
FROM            dbo.SettingsItems INNER JOIN
                         dbo.SettingsPackages ON dbo.SettingsItems.ItemID = dbo.SettingsPackages.ItemID
```

### `dbo.ViewPurchases`

```sql
CREATE VIEW [dbo].[ViewPurchases]
AS
SELECT        dbo.Purchases.PurchaseID, dbo.Purchases.PurchaseDate, dbo.Purchases.Pattern, dbo.Purchases.Status, dbo.Purchases.BillNo, dbo.Purchases.PartnerID, dbo.SettingsPartners.PartnerName, 
                         dbo.Purchases.Total, dbo.Purchases.SavedBy, SavedUsers.UserName AS SavedUser, dbo.Purchases.SavedOn, dbo.Purchases.ApprovedBy, ApprovedUsers.UserName AS ApprovedUser, 
                         dbo.Purchases.ApprovedOn, dbo.Purchases.UpdatedBy, UpdatedUsers.UserName AS UpdatedUser, dbo.Purchases.UpdatedOn, dbo.SettingsCompanyProfile.CompanyName, 
                         dbo.SettingsCompanyProfile.CompanyAddress, dbo.SettingsCompanyProfile.CompanyPhone1, dbo.SettingsCompanyProfile.CompanyPhone2, dbo.SettingsCompanyProfile.CompanyMobileNo, 
                         dbo.SettingsCompanyProfile.Logo, dbo.SettingsCompanyProfile.CompanyWebsite, dbo.SettingsCompanyProfile.CompanyEmail, dbo.Purchases.BranchID, dbo.Purchases.Discount, dbo.Purchases.NetTotal
FROM            dbo.Users AS UpdatedUsers INNER JOIN
                         dbo.Users AS ApprovedUsers INNER JOIN
                         dbo.Purchases INNER JOIN
                         dbo.SettingsPartners ON dbo.Purchases.PartnerID = dbo.SettingsPartners.PartnerID INNER JOIN
                         dbo.Users AS SavedUsers ON dbo.Purchases.SavedBy = SavedUsers.UserID ON ApprovedUsers.UserID = dbo.Purchases.ApprovedBy ON UpdatedUsers.UserID = dbo.Purchases.UpdatedBy INNER JOIN
                         dbo.SettingsCompanyProfile ON dbo.Purchases.CompanyID = dbo.SettingsCompanyProfile.CompanyID
```

### `dbo.ViewRequests`

```sql
CREATE VIEW [dbo].[ViewRequests]
AS
SELECT        dbo.Requests.RequestID, dbo.Requests.RequestDate, dbo.Requests.Pattern, dbo.Requests.Status, dbo.Requests.FromBranch, FromBranch.BranchName AS FromBranchName, dbo.Requests.ToBranch, 
                         ToBranches.BranchName AS ToBranchName, dbo.Requests.CompanyID, dbo.SettingsCompanyProfile.CompanyName, dbo.SettingsCompanyProfile.CompanyAddress, 
                         dbo.SettingsCompanyProfile.CompanyPhone1, dbo.SettingsCompanyProfile.CompanyPhone2, dbo.SettingsCompanyProfile.CompanyMobileNo, dbo.SettingsCompanyProfile.CompanyFax, 
                         dbo.SettingsCompanyProfile.CompanyEmail, dbo.SettingsCompanyProfile.CompanyWebsite, dbo.SettingsCompanyProfile.Logo, dbo.Requests.SavedBy, SavedUsers.UserName AS SavedUser, 
                         dbo.Requests.SavedOn, dbo.Requests.ApprovedBy, ApprovedUsers.UserName AS ApprovedUser, dbo.Requests.ApprovedOn, dbo.Requests.UpdatedBy, UpdatedUser.UserName AS UpdatedUser, 
                         dbo.Requests.UpdatedOn, dbo.Requests.Total
FROM            dbo.Requests INNER JOIN
                         dbo.SettingsBranches AS FromBranch ON dbo.Requests.FromBranch = FromBranch.BranchID INNER JOIN
                         dbo.SettingsBranches AS ToBranches ON dbo.Requests.ToBranch = ToBranches.BranchID INNER JOIN
                         dbo.SettingsCompanyProfile ON dbo.Requests.CompanyID = dbo.SettingsCompanyProfile.CompanyID INNER JOIN
                         dbo.Users AS SavedUsers ON dbo.Requests.SavedBy = SavedUsers.UserID INNER JOIN
                         dbo.Users AS ApprovedUsers ON dbo.Requests.ApprovedBy = ApprovedUsers.UserID INNER JOIN
                         dbo.Users AS UpdatedUser ON dbo.Requests.UpdatedBy = UpdatedUser.UserID
```

### `dbo.ViewSales`

```sql
CREATE VIEW [dbo].[ViewSales]
AS
SELECT        dbo.Sales.SaleID, dbo.Sales.SaleDate, dbo.Sales.Pattern, dbo.Sales.Status, dbo.Sales.PartnerID, dbo.SettingsPartners.PartnerName, dbo.Sales.Total, dbo.Sales.SavedBy, SavedUsers.UserName AS SavedUser, 
                         dbo.Sales.SavedOn, dbo.Sales.ApprovedBy, dbo.Sales.ApprovedOn, ApprovedUsers.UserName AS ApprovedUser, dbo.Sales.UpdatedBy, UpdatedUsers.UserName AS UpdatedUser, dbo.SettingsCompanyProfile.CompanyName, 
                         dbo.SettingsCompanyProfile.CompanyAddress, dbo.SettingsCompanyProfile.CompanyPhone1, dbo.SettingsCompanyProfile.CompanyPhone2, dbo.SettingsCompanyProfile.CompanyMobileNo, 
                         dbo.SettingsCompanyProfile.CompanyEmail, dbo.SettingsCompanyProfile.CompanyWebsite, dbo.SettingsCompanyProfile.Logo, dbo.Sales.CompanyID, dbo.Sales.BranchID, dbo.Sales.Discount, dbo.Sales.NetTotal, 
                         dbo.Sales.SalesManName
FROM            dbo.Users AS SavedUsers INNER JOIN
                         dbo.Sales INNER JOIN
                         dbo.SettingsPartners ON dbo.Sales.PartnerID = dbo.SettingsPartners.PartnerID INNER JOIN
                         dbo.SettingsCompanyProfile ON dbo.Sales.CompanyID = dbo.SettingsCompanyProfile.CompanyID ON SavedUsers.UserID = dbo.Sales.SavedBy INNER JOIN
                         dbo.Users AS ApprovedUsers ON dbo.Sales.ApprovedBy = ApprovedUsers.UserID INNER JOIN
                         dbo.Users AS UpdatedUsers ON dbo.Sales.UpdatedBy = UpdatedUsers.UserID
```

### `dbo.ViewStock`

```sql
CREATE VIEW [dbo].[ViewStock]
AS
SELECT   dbo.Stock.BranchID, dbo.Stock.StockType, dbo.Stock.MoveNo, dbo.Stock.Pattern, dbo.Stock.ItemID, dbo.SettingsItems.ItemName, dbo.SettingsItems.UnitName, dbo.Stock.PatchID, dbo.Stock.QuantityIn, dbo.Stock.QuantityOut, dbo.Stock.BonusIn, dbo.Stock.BonusOut, dbo.Stock.WholePrice, dbo.Stock.SellPrice, dbo.Stock.TotalPrice, 
             dbo.Stock.ExpiryDate, dbo.SettingsItems.BigUnitName, dbo.Stock.BarCode, dbo.SettingsItems.ManufacturerName, dbo.Stock.StockDate, dbo.SettingsBranches.BranchName, dbo.Purchases.PartnerID
FROM     dbo.SettingsItems INNER JOIN
             dbo.Stock ON dbo.SettingsItems.ItemID = dbo.Stock.ItemID INNER JOIN
             dbo.SettingsBranches ON dbo.Stock.BranchID = dbo.SettingsBranches.BranchID INNER JOIN
             dbo.Purchases ON dbo.Stock.Pattern = dbo.Purchases.Pattern
```

### `dbo.ViewTempStocks`

```sql
CREATE VIEW dbo.ViewTempStocks
AS
SELECT dbo.TempStocks.Pattern, dbo.TempStocks.ItemID, dbo.TempStocks.QuantityOut, dbo.TempStocks.WholePrice, dbo.TempStocks.ExpiryDate, dbo.SettingsItems.ItemName, dbo.SettingsItems.UnitName, dbo.TempStocks.QuantityIn, dbo.TempStocks.BonusIn, 
             dbo.TempStocks.BonusOut, dbo.TempStocks.TotalPrice, dbo.TempStocks.SellPrice, dbo.TempStocks.TempStockType, dbo.TempStocks.BarCode, dbo.TempStocks.TempStockID, dbo.TempStocks.PatchID, dbo.TempStocks.RefNo
FROM   dbo.TempStocks INNER JOIN
             dbo.SettingsItems ON dbo.TempStocks.ItemID = dbo.SettingsItems.ItemID
```

### `dbo.ViewTransaction`

```sql
CREATE VIEW [dbo].[ViewTransaction]
AS
SELECT        dbo.Transactions.BranchID, dbo.SettingsBranches.BranchName, dbo.Transactions.TransactionID, dbo.Transactions.TransactionDate, dbo.Transactions.MoveNo, dbo.Transactions.TransactionType, dbo.Transactions.Pattern, 
                         dbo.Transactions.AccountID, dbo.Accounts.AccountName, dbo.Transactions.PartnerID, dbo.SettingsPartners.PartnerName, dbo.Transactions.RefNo, dbo.Transactions.Description, dbo.Transactions.Debit, dbo.Transactions.Credit, 
                         dbo.Transactions.SavedBy, dbo.Users.UserName AS SavedUser, dbo.Transactions.SavedOn
FROM            dbo.Transactions INNER JOIN
                         dbo.SettingsBranches ON dbo.Transactions.BranchID = dbo.SettingsBranches.BranchID INNER JOIN
                         dbo.Accounts ON dbo.Transactions.AccountID = dbo.Accounts.AccountID INNER JOIN
                         dbo.SettingsPartners ON dbo.Transactions.PartnerID = dbo.SettingsPartners.PartnerID INNER JOIN
                         dbo.Users ON dbo.Transactions.SavedBy = dbo.Users.UserID
```

## Stored procedures

### `dbo.SP_InitialBill_Save`

```sql
CREATE PROCEDURE [dbo].[SP_InitialBill_Save] 
 @BillNo INT=0,
 @BranchID INT=0,
 @PartnerID INT,
 @SaleManID Nvarchar(300),
 @ItemsAndQntJson Nvarchar(MAX)=Null,
 @Result  NVARCHAR(4000) Output
AS
SET NOCOUNT, XACT_ABORT ON;
BEGIN TRY 
 BEGIN TRANSACTION

 IF @ItemsAndQntJson=''
 Begin
 Set @ItemsAndQntJson=Null
 End 

 Declare @BranchCode Nvarchar(50),@NewSaleID Int,@MoveNo INT,@Pattern Nvarchar(50),@SaleManName Nvarchar(100) 
 Select @BranchCode=BranchCode From SettingsBranches Where BranchID=@BranchID
 Select @MoveNo=Mov From (Select ISNULL(Max(MoveNo),0)+1 Mov FROM Sales Where BranchID=@BranchID)MV
 Select @SaleManName=SalesManName  from SettingsSalesMen Where SalesManID=@SaleManID
 -----------------------Sales-----------------------
If(@BillNo=0 And @ItemsAndQntJson is not Null)
	Begin
	Select @NewSaleID=ISNull(Max(SaleID),0)+1 From Sales
	--Set @Pattern= 'SO-'+REPLACE(STR(@MoveNo, 4), SPACE(1), '0') 
	Set @Pattern='SO-DOR-'+ FORMAT(@MoveNo, '0000')
    Insert Into Sales (BranchID,SaleID,MoveNo,SaleDate,Pattern,Status,PartnerID,SalesManName,Discount,Total,SavedBy) Values
                      (@BranchID,@NewSaleID,@MoveNo,GetDate(),@Pattern,N'جديد',@PartnerID,@SaleManName,0,0,@SaleManID)
	
	Set @Result=N'تم إضافة الفاتورة بنجاح '  + Cast(@NewSaleID As nvarchar)
End 
-----------------------SaveItems-----------------------

If(@ItemsAndQntJson is not Null)
Begin
	If(@BillNo<>0)
	Begin
		Select @NewSaleID=SaleID,@Pattern=Pattern From Sales Where  BranchID=@BranchID And SaleID=@BillNo
		Delete From TempStocks Where  BranchID=@BranchID And RefNo=@BillNo
		Set @Result=N'تم تعديل الفاتورة بنجاح'
	End
	Declare @AllItems as table (ItemID INT,Qnt INT)
	SELECT @ItemsAndQntJson=REPLACE(@ItemsAndQntJson, '#', '"')
	Insert Into @AllItems
	SELECT * FROM OPENJSON(@ItemsAndQntJson)
	WITH ( ItemID INT '$.ItemID' , Qnt  INT '$.Qnt') 

	Declare @AllItemsWithPrice as table (ItemID INT,Qnt INT,SellPrice Float,TotalPrice Float)

	Insert Into @AllItemsWithPrice 
	Select A.ItemID, A.Qnt,P.SellPrice,A.Qnt*P.SellPrice TotalPrice From @AllItems A
	Inner Join SettingsItems P
	On P.ItemID=A.ItemID

	Insert Into TempStocks (BranchID,Pattern,RefNo,TempStockType,ItemID,QuantityOut,SellPrice,TotalPrice) 
	Select @BranchID BranchID,@Pattern Pattern,@NewSaleID RefNo,N'بيع' TempStockType,* From @AllItemsWithPrice
End		

IF(@BillNo<>0 And @ItemsAndQntJson IS Null)
Begin
	Delete From Sales Where BranchID=@BranchID And SaleID=@BillNo
	Delete From TempStocks Where  BranchID=@BranchID And RefNo=@BillNo
	Set @Result= N'تم حذف الفاتورة بنجاح' 
End
Select @Result
Commit

END TRY
BEGIN CATCH
	IF @@TRANCOUNT > 0 ROLLBACK

	DECLARE @em NVARCHAR(1000) = ERROR_MESSAGE();
	RAISERROR(@em, 16, 1);
	RETURN
END CATCH
```

### `dbo.SP_SaleOrder`

```sql
CREATE PROCEDURE [dbo].[SP_SaleOrder] 
 @BranchID INT,
 @PartnerID INT,
 @Total Float,
 @Discount Float,
 @SavedBy Int,
 @ItemsAndQntJson Nvarchar(MAX)=Null,
 @DebAccountID INT,
 @TotalWholePrice Float,
 @Result  NVARCHAR(4000) Output

 AS
SET NOCOUNT, XACT_ABORT ON;
BEGIN TRY 
 BEGIN TRANSACTION

Declare @BranchCode Nvarchar(50) ,@SaleMoveNo INT,@SalePattren Nvarchar(100),@SaleManName Nvarchar(300)

Select @BranchCode=BranchCode From SettingsBranches Where BranchID=@BranchID
Select @SaleMoveNo=Mov From (Select ISNULL(Max(MoveNo),0)+1 Mov FROM Sales Where BranchID=@BranchID)MV
Set @SalePattren='SO-'+@BranchCode+'-'+ FORMAT(@SaleMoveNo, '0000')

Select @SaleManName=SalesManName from SettingsPartners Where PartnerID=@PartnerID
 ----Sales--------------------------------------------------------------------------------------------------------------
	Declare @NewSaleID Int
	Select @NewSaleID=ISNull(Max(SaleID),0)+1 From Sales

	 

 Insert Into Sales (BranchID,SaleID,MoveNo,SaleDate,Pattern,Status,PartnerID,SalesManName,Discount,Total,SavedBy) Values(@BranchID,@NewSaleID,@SaleMoveNo,GetDAte(),@SalePattren,N'مؤكد',@PartnerID,@SaleManName,@Discount,@Total,@SavedBy)

 --Select @Result='s'
  -----------------------SaveItems--------------------------------------------------------------------


    Declare @AllItems as table (SellRownm INT,SellItemID INT,SellQnt INT,SellPrice Float)
	
	--set @ItemsAndQntJson=REPLACE(@ItemsAndQntJson, '#', '')
 --    set @ItemsAndQntJson=REPLACE(@ItemsAndQntJson, '!', '"')
	 SELECT @ItemsAndQntJson=REPLACE(@ItemsAndQntJson, '#', '')
     SELECT @ItemsAndQntJson=REPLACE(@ItemsAndQntJson, '!', '"')

Insert Into @AllItems
SELECT * FROM OPENJSON(@ItemsAndQntJson)
                WITH (SellRownm INT '$.SellRownm',
                      SellItemID  INT '$.SellItemID',  
                      SellQnt INT '$.SellQnt',
                      SellPrice float '$.SellPrice'
                      ) 

		--Create table temptest (SellNo Int,ItmID Int,Qnt Int)	 
		--insert into temptest Select * from @AllItems
		
Declare @ItemsCnt INT
Select @ItemsCnt=count(*) from @AllItems
Print @ItemsCnt
Declare @Counter INT=1

 DECLARE @SellRecord TABLE
(BranchID Int, 
 StockID Int,
 StockType Nvarchar(50),
 Pattren Nvarchar(100),
 ItemID Int,
 BatchID int,
 WholePrice Float,
 SalePrice Float,
 QntOut int,
 TotalPrice Float,
 ExpiryDate Date,
 StokDate Date
)

 DECLARE @PrevSelectedBatch TABLE
(
 BatchID int
)

 DECLARE @BatchesQnt TABLE
(
 BatchID int,AvailableQnt int
)

WHILE @Counter<=@ItemsCnt+1
BEGIN
Delete From @SellRecord
Delete From @PrevSelectedBatch
Delete from @BatchesQnt
Declare @TargetItemID Int, @TratgetItemQnt Int,@SellPrice Float,@StockID Int 

Select   @TargetItemID=SellItemID,@TratgetItemQnt=sellQnt,@SellPrice=SellPrice  from @AllItems Where SellRownm=@Counter
--Select   @SellPrice=SellPrice From SettingsItems Where ItemID=@TargetItemID


Insert Into @BatchesQnt 
Select PatchID,Sum(QuantityIn+BonusIn)-SUM(QuantityOut+BonusOut) AvailableQnt  from Stock Where ItemID=@TargetItemID And BranchID=@BranchID Group By PatchID 
Having Sum(QuantityIn+BonusIn)-SUM(QuantityOut+BonusOut) <>0
Order By PatchID


 Declare @TotalAvailableQnt INT
 Select @TotalAvailableQnt=Sum(AvailableQnt) from  @BatchesQnt 

 IF @TotalAvailableQnt<@TratgetItemQnt
 Begin
    Rollback
	DECLARE @e NVARCHAR(1000) = 'Quantity is greater than available!';
	RAISERROR(@e, 16, 1);
	RETURN
 End


WHILE @TratgetItemQnt >0
 BEGIN
	Declare @OlderBatchID Int,@OlderBatchQnt Int,@BatchWholePrice Float,@BatchExpiryDate Date 
    Select top 1 @OlderBatchID=BatchID,@OlderBatchQnt=AvailableQnt from @BatchesQnt where BatchID not in ( Select BatchID from @PrevSelectedBatch)
	
	IF @OlderBatchQnt>=@TratgetItemQnt
	Begin
	Select @BatchWholePrice=WholePrice,@BatchExpiryDate=ExpiryDate from ViewStock Where StockType=N'شراء' And ItemID=@TargetItemID and PatchID=@OlderBatchID
	Select @StockID=stkID from (Select ISNULL(Max(StockID),0)+1 stkID from Stock)s
	--Insert Into @SellRecord Values (@BranchID,@StockID,@SalePattren,@TargetItemID,@OlderBatchID,@BatchWholePrice,@SellPrice,@TratgetItemQnt,@SellPrice*@OlderBatchQnt,@BatchExpiryDate,GETDATE())
	
	Insert Into Stock (BranchID,StockID,StockType,Pattern,ItemID,PatchID,WholePrice,SellPrice,QuantityOut,TotalPrice,ExpiryDate,StockDate) 
	Values (@BranchID,@StockID,N'بيع',@SalePattren,@TargetItemID,@OlderBatchID,@BatchWholePrice,@SellPrice,@TratgetItemQnt,@SellPrice*@TratgetItemQnt,@BatchExpiryDate,GETDATE())
	--Set @Counter+=1
	Set @TratgetItemQnt=0
	 
	Break 
	End



	IF @OlderBatchQnt<@TratgetItemQnt
   Begin
   --Insert Into @SellRecord Values (@TargetItemID,'Oil',@OlderBatchID,0,@OlderBatchQnt)

   Select @BatchWholePrice=WholePrice,@BatchExpiryDate=ExpiryDate from ViewStock Where StockType=N'شراء' And ItemID=@TargetItemID and PatchID=@OlderBatchID
	Select @StockID=stkID from (Select ISNULL(Max(StockID),0)+1 stkID from Stock)s
	--Insert Into @SellRecord Values (@BranchID,@StockID,@SalePattren,@TargetItemID,@OlderBatchID,@BatchWholePrice,@SellPrice,@OlderBatchQnt,@SellPrice*@OlderBatchQnt,@BatchExpiryDate,GETDATE())
	Insert Into Stock (BranchID,StockID,StockType,Pattern,ItemID,PatchID,WholePrice,SellPrice,QuantityOut,TotalPrice,ExpiryDate,StockDate) 
	Values (@BranchID,@StockID,N'بيع',@SalePattren,@TargetItemID,@OlderBatchID,@BatchWholePrice,@SellPrice,@OlderBatchQnt,@SellPrice*@OlderBatchQnt,@BatchExpiryDate,GETDATE())
	Insert INto @PrevSelectedBatch Values(@OlderBatchID)
		Print 'Insert Item Loop2: '+ cast(@TargetItemID as NVarchar)+'  Batch: '+cast(@OlderBatchID as NVarchar)+'  Qnt: ' +cast(@TratgetItemQnt as NVarchar)

    SET @TratgetItemQnt =@TratgetItemQnt-@OlderBatchQnt
	ENd
 END

Set @Counter=@Counter+1
End


 ------Transactions -----------------
 
Declare @TransMoveNo INT,@TransPattren Nvarchar(100)
Select @TransMoveNo=Mov From (Select ISNULL(Max(MoveNo),0)+1 Mov FROM Transactions Where BranchID=@BranchID
And TransactionType=N'أمر بيع')MV
Set @TransPattren='INV-DOR-'+ FORMAT(@TransMoveNo, '0000')
--Debit
Insert Into Transactions (TransactionDate,MoveNo,TransactionType,Pattern,AccountID,PartnerID,RefNo,Description,Debit,Credit,SavedBy)
                                          Values 
                                          (GetDate(),@TransMoveNo,N'أمر بيع',@TransPattren,@DebAccountID,@PartnerID,@SalePattren,N'فاتورة بيع', @Total-@Discount,0,@SavedBy)

--Credit
Insert Into Transactions (TransactionDate,MoveNo,TransactionType,Pattern,AccountID,PartnerID,RefNo,Description,Debit,Credit,SavedBy)
                                          Values 
                                          (GetDate(),@TransMoveNo,N'أمر بيع',@TransPattren,'301001',0,@SalePattren,N'فاتورة بيع', 0,@Total-@Discount-@TotalWholePrice,@SavedBy)
--Inventory
Insert Into Transactions (TransactionDate,MoveNo,TransactionType,Pattern,AccountID,PartnerID,RefNo,Description,Debit,Credit,SavedBy)
                                          Values 
                                          (GetDate(),@TransMoveNo,N'أمر بيع',@TransPattren,'104001',0,@SalePattren,N'فاتورة بيع', 0,@TotalWholePrice,@SavedBy)

Select @Result=N'تم الحفظ بنجاح'

Commit

END TRY
BEGIN CATCH
	IF @@TRANCOUNT > 0 ROLLBACK

	DECLARE @em NVARCHAR(1000) = ERROR_MESSAGE();
	RAISERROR(@em, 16, 1);
	RETURN
END CATCH
```

## Functions

## Triggers

## Primary keys and foreign keys

| Type | Table | Constraint | Column | Reference |
|---|---|---|---|---|
| PK | `dbo.SettingsInsuranceGroupsItems` | `PK_InsuranceGroupsItems` | `InsuranceGroupItemID` | `—` |
| PK | `dbo.Sales` | `PK_Sales` | `SaleID` | `—` |
| PK | `dbo.SettingsItems` | `PK_SettingsItems` | `ItemID` | `—` |
| PK | `dbo.SettingsPackages` | `PK_SettingsPackeges` | `PackageID` | `—` |
| PK | `dbo.SettingsPartners` | `PK_Partners` | `PartnerID` | `—` |
| PK | `dbo.Stock` | `PK_Stock` | `StockID` | `—` |
| PK | `dbo.SettingsUnits` | `PK_SettingsUnits` | `UnitID` | `—` |
| PK | `dbo.Cashier` | `PK_Cashier` | `CashierID` | `—` |
| PK | `dbo.Cheques` | `PK_Cheques` | `ChequeID` | `—` |
| PK | `dbo.Disposes` | `PK_Disposes` | `DisposeID` | `—` |
| PK | `dbo.InsuranceContracts` | `PK_Insurance` | `InsuranceContractID` | `—` |
| PK | `dbo.Users` | `PK_Users` | `UserID` | `—` |
| PK | `dbo.Transactions` | `PK_Transactions` | `TransactionID` | `—` |
| PK | `dbo.InsuranceExceptionsGroups` | `PK_InsuranceContractsExceptions` | `InsuranceExceptionsGroupID` | `—` |
| PK | `dbo.TempStocks` | `PK_TempStocks` | `TempStockID` | `—` |
| PK | `dbo.InsuranceGroups` | `PK_InsuranceCategoryCeil` | `InsuranceGroupID` | `—` |
| PK | `dbo.InsurancePriceList` | `PK_InsurancePriceList` | `PriceListID` | `—` |
| PK | `dbo.InsuranceSales` | `PK_InsuranceSales` | `InsranceSalesID` | `—` |
| PK | `dbo.InsuranceSalesTransactions` | `PK_InsuranceSalesTransactions` | `InsranceTransactionID` | `—` |
| PK | `dbo.InvociesReconciliation` | `PK_SalesReconciliation` | `InvocieReconciliationID` | `—` |
| PK | `dbo.OutOfInsuranceItems` | `PK_OutOfInsuranceItems` | `OutOfInsuranceID` | `—` |
| PK | `dbo.OutOfInsuranceItemsExceptions` | `PK_OutOfInsuranceItemsExceptions` | `ItemExceptionID` | `—` |
| PK | `dbo.Requests` | `PK_Requests` | `RequestID` | `—` |
| PK | `dbo.SettingsBranches` | `PK_SettingsPharmacies` | `BranchID` | `—` |
| PK | `dbo.SettingsBranchesMap` | `PK_SettingsBranchesMap` | `MacAddress` | `—` |
| PK | `dbo.SettingsCategories` | `PK_SettingsCatogeries` | `CategoryID` | `—` |
| PK | `dbo.InsuranceExceptions` | `PK_InsuranceItemCeil` | `InsuranceExceptionID` | `—` |
| PK | `dbo.SettingsCompanyProfile` | `PK_SettingsCompanyProfile` | `CompanyID` | `—` |
| PK | `dbo.Payments` | `PK_Payments` | `PaymentID` | `—` |
| PK | `dbo.SettingsGenerics` | `PK_SettingsGeneric` | `GenericID` | `—` |
| PK | `dbo.Purchases` | `PK_Purchases` | `PurchaseID` | `—` |
| PK | `dbo.SettingsInsuranceExceptions` | `PK_SettingsInsuranceExceptions` | `ExceptionName` | `—` |
| PK | `dbo.SettingsInsuranceGroups` | `PK_InsuranceGroups` | `InsuranceGroupID` | `—` |
| FK | `dbo.Stock` | `FK_Stock_SettingsItems` | `ItemID` | `dbo.SettingsItems.ItemID` |
| FK | `dbo.SettingsItems` | `FK_SettingsItems_SettingsItems` | `ItemID` | `dbo.SettingsItems.ItemID` |
| FK | `dbo.TempStocks` | `FK_TempStocks_SettingsItems` | `ItemID` | `dbo.SettingsItems.ItemID` |
| FK | `dbo.Requests` | `FK_Requests_SettingsPartners` | `PartnerID` | `dbo.SettingsPartners.PartnerID` |
| FK | `dbo.SettingsItems` | `FK_SettingsItems_SettingsCategories` | `CategoryID` | `dbo.SettingsCategories.CategoryID` |
| FK | `dbo.SettingsItems` | `FK_SettingsItems_SettingsGenerics` | `GenericID` | `dbo.SettingsGenerics.GenericID` |

## User-table index inventory

The previous compact scan included SQL Server system indexes. The filtered read-only query below includes user tables only. It found two non-PK indexes across three key columns:

- `dbo.SettingsBranchesMap` / `IX_SettingsBranchesMap`: `BranchID` (non-unique).
- `dbo.SettingsPackages` / `IX_SettingsPackages`: composite unique index on `BasicItemID`, `ItemID`.

## Metadata coverage notes

Column defaults, primary keys, foreign keys, user-table non-PK indexes, unique constraints/indexes, and check constraints are listed above. The compact index display does not include full index options, disabled flags, or column-level collation. The six declared foreign keys are sparse relative to probable logical links found in source code.
## Limited representative data check

A read-only sample of `SettingsCategories` returned one visible category row (`CategoryID` 8, Arabic display label `بيرقر`). Distinct-value checks returned no rows for `Purchases.Status` and `Transactions.TransactionType` in this database at inspection time, so live transaction examples were unavailable from those columns. No customer, user, credential, or financial document rows were copied into these documents.

## Check and unique constraints

- No check constraints were found on user tables.
- Unique constraints: `InsuranceContracts.UQ_Name_BenefitName`; `SettingsBenefits.UQ_BenefitName`; `SettingsInsuranceCompanies.UQ_InsuranceCompanyName`.
- `SettingsPackages.IX_SettingsPackages` is a unique composite index, listed above.
- Trigger and function catalog scans returned none.