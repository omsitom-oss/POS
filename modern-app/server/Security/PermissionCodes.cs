namespace ElitePos.LocalService.Security;

// Permission codes stored in dbo.Permissions. Each code is also the name of an
// authorization policy, so endpoints call RequirePermission(PermissionCodes.X).
public static class PermissionCodes
{
    public const string UserManagement = "USER_MANAGEMENT";
    public const string SettingsManage = "SETTINGS_MANAGE";
    public const string ExchangeRatesEdit = "EXCHANGE_RATES_EDIT";
    public const string ItemsManage = "ITEMS_MANAGE";
    public const string PartnersManage = "PARTNERS_MANAGE";
    public const string SalesView = "SALES_VIEW";
    public const string SalesCreate = "SALES_CREATE";
    public const string SalesReturn = "SALES_RETURN";
    public const string SalesPriceOverride = "SALES_PRICE_OVERRIDE";
    public const string PurchasesView = "PURCHASES_VIEW";
    public const string PurchasesManage = "PURCHASES_MANAGE";
    public const string PurchaseReturn = "PURCHASE_RETURN";
    public const string PurchaseReturnApprove = "PURCHASE_RETURN_APPROVE";
    public const string InventoryView = "INVENTORY_VIEW";
    public const string InventoryDispose = "INVENTORY_DISPOSE";
    public const string InventoryApprove = "INVENTORY_APPROVE";
    public const string TreasuryView = "TREASURY_VIEW";
    public const string TreasuryManage = "TREASURY_MANAGE";
    public const string JournalPost = "JOURNAL_POST";
    public const string ReportsView = "REPORTS_VIEW";
    public const string AllBranches = "ALL_BRANCHES";
    public const string ManagementAccess = "MANAGEMENT_ACCESS";

    public static readonly IReadOnlyList<string> All =
    [
        UserManagement, SettingsManage, ExchangeRatesEdit, ItemsManage, PartnersManage,
        SalesView, SalesCreate, SalesReturn, SalesPriceOverride, PurchasesView, PurchasesManage, PurchaseReturn, PurchaseReturnApprove,
        InventoryView, InventoryDispose, InventoryApprove, TreasuryView, TreasuryManage, JournalPost,
        ReportsView, AllBranches, ManagementAccess,
    ];
}
