import { useCallback, useState } from "react";
import {
  Button,
  ErrorState,
  FilterChips,
  IconButton,
  Money,
  StatusBadge,
} from "../../components/shared";
import { DataTable, type TableColumn } from "../../components/DataTable";
import { datePresetOptions, inDatePreset, sumBy, type DatePreset } from "../../components/listFilters";
import { useLoadEffect } from "../../components/useLoadEffect";
import { PageHeader, type Locale } from "../../layouts/AppLayout";
import { Icon } from "../../components/icons";
import { formatPurchaseDate, type Currency, type Item, type Purchase, type Supplier } from "./purchaseModel";
import { printPurchase } from "./printPurchase";
import { PurchaseDetailModal } from "./PurchaseDetailModal";
import { PurchaseEditor } from "./PurchaseEditor";
import { usePurchaseDetail } from "./usePurchaseDetail";
import { usePurchaseEditor } from "./usePurchaseEditor";

export function PurchasesPage({ locale, onImport }: { locale: Locale; onImport?: (purchaseId?: number) => void }) {
  const ar = locale === "ar";
  const [rows, setRows] = useState<Purchase[]>([]),
    [suppliers, setSuppliers] = useState<Supplier[]>([]),
    [items, setItems] = useState<Item[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<"POSTED" | "DRAFT" | "IMPORT">("POSTED");
  const [currencyId, setCurrencyId] = useState<number | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState("SDG");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, o, i, r] = await Promise.all([
        fetch("/api/partners"),
        fetch("/api/partners/options"),
        fetch("/api/items"),
        fetch("/api/purchases"),
      ]);
      if (!p.ok || !o.ok || !i.ok || !r.ok) throw new Error("Request failed");
      const ps = (await p.json()) as Supplier[];
      const options = (await o.json()) as Array<{
        partnerId: number;
        partnerCode: string;
        partnerName: string;
      }>;
      setSuppliers(
        ps
          .filter(
            (x) =>
              x.partnerTypeCode === "SUPPLIER" || x.partnerTypeCode === "BOTH",
          )
          .map((x) => {
            const option = options.find(
              (o) => o.partnerCode === x.customerCode,
            );
            return {
              ...x,
              partnerId: option?.partnerId ?? x.partnerId,
              businessName: x.businessName ?? option?.partnerName,
            };
          })
          .filter((x) => x.partnerId > 0),
      );
      setItems(await i.json());
      setRows(await r.json());
      try {
        const currencyResponse = await fetch("/api/currencies");
        if (currencyResponse.ok) {
          const currencies = (await currencyResponse.json()) as Currency[];
          const primary = currencies.find((item) => item.isPrimary && item.isActive) ?? currencies.find((item) => item.isActive);
          setCurrencyId(primary?.currencyId ?? null);
          setCurrencySymbol(primary?.symbol || "SDG");
        }
      } catch {
        // The server resolves the active primary currency when this optional lookup is unavailable.
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : ar
            ? "تعذر التحميل."
            : "Could not load purchases.",
      );
    } finally {
      setLoading(false);
    }
  }, [ar]);
  useLoadEffect(load);
  const editor = usePurchaseEditor({
    ar,
    items,
    currencyId,
    setError,
    onSaved: async () => {
      setEditing(false);
      await load();
    },
  });
  const purchaseDetail = usePurchaseDetail({ ar, setError });
  const [period, setPeriod] = useState<DatePreset>("all");
  const inTab = (row: Purchase, tab: typeof activeTab) => tab === "IMPORT" ? row.purchaseType === "IMPORT" : row.purchaseType !== "IMPORT" && row.status === tab;
  const inPeriod = rows.filter((row) => inDatePreset(row.purchaseDate, period));
  const visibleRows = inPeriod.filter((row) => inTab(row, activeTab));
  const columns: Array<TableColumn<Purchase>> = [
    { key: "invoiceNo", title: ar ? "رقم الفاتورة" : "Invoice", value: (x) => x.invoiceNo, render: (x) => <span className="doc-no">{x.invoiceNo}</span> },
    { key: "purchaseDate", title: ar ? "التاريخ" : "Date", value: (x) => x.purchaseDate, render: (x) => formatPurchaseDate(x.purchaseDate), searchable: false },
    { key: "supplierName", title: ar ? "المورد" : "Supplier", value: (x) => x.supplierName, wrap: true },
    { key: "status", title: ar ? "الحالة" : "Status", value: (x) => x.status, searchable: false, render: (x) => <StatusBadge tone={x.status === "POSTED" ? "success" : "neutral"}>{x.status === "POSTED" ? (ar ? "نهائية" : "Posted") : (ar ? "مبدئية" : "Draft")}</StatusBadge> },
    { key: "lineCount", title: ar ? "الأصناف" : "Items", value: (x) => x.lineCount, align: "end", searchable: false },
    { key: "total", title: ar ? "الإجمالي" : "Total", value: (x) => x.total, align: "end", searchable: false, render: (x) => <Money value={x.total} symbol={x.currencySymbol} /> },
  ];
  async function confirmDraft(purchaseId: number) {
    if (!window.confirm(ar ? "تأكيد الفاتورة سيؤثر على المخزون والحسابات. هل تريد المتابعة؟" : "Confirming this invoice will update stock and accounts. Continue?")) return;
    const response = await fetch(`/api/purchases/${purchaseId}/confirm`, { method: "POST" });
    if (!response.ok) { setError(await response.text()); return; }
    await load();
  }
  async function cancelDraft(purchaseId: number) {
    if (!window.confirm(ar ? "هل تريد إلغاء وحذف الفاتورة المبدئية؟" : "Cancel and delete this draft invoice?")) return;
    const response = await fetch(`/api/purchases/${purchaseId}`, { method: "DELETE" });
    if (!response.ok) { setError(await response.text()); return; }
    await load();
  }
  if (editing)
    return (
      <PurchaseEditor
        ar={ar}
        editor={editor}
        suppliers={suppliers}
        items={items}
        currencySymbol={currencySymbol}
        error={error}
        onCancel={() => setEditing(false)}
      />
    );
  return (
    <div className="settings-page" dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        title={ar ? "المشتريات" : "Purchases"}
        description={
          ar
            ? "إدارة فواتير الشراء وتأثيرها على المخزون والحسابات."
            : "Manage purchase invoices and their stock/accounting impact."
        }
        actions={
          <div className="page-actions">
            <Button variant="secondary" onClick={() => onImport?.()}>
              <Icon name="plus" size={18} />{ar ? "استيراد بضاعة" : "Import goods"}
            </Button>
            <Button variant="primary" onClick={() => setEditing(true)}>
              <Icon name="plus" size={18} />{ar ? "فاتورة جديدة" : "New invoice"}
            </Button>
          </div>
        }
      />
      {error && (
        <ErrorState
          title={ar ? "تعذر تحميل المشتريات" : "Could not load purchases"}
          detail={error}
        />
      )}
      <DataTable
        locale={locale}
        columns={columns}
        rows={visibleRows}
        rowKey={(x) => x.purchaseId}
        loading={loading}
        density="compact"
        pageSize={15}
        searchPlaceholder={ar ? "رقم الفاتورة أو المورد" : "Invoice or supplier"}
        searchLabel={ar ? "بحث في فواتير الشراء" : "Search purchase invoices"}
        filters={<>
          <FilterChips label={ar ? "نوع الفاتورة" : "Invoice type"} value={activeTab} onChange={setActiveTab} options={[
            { value: "POSTED", label: ar ? "النهائية" : "Final invoices", count: inPeriod.filter((row) => inTab(row, "POSTED")).length },
            { value: "DRAFT", label: ar ? "المبدئية" : "Initial invoices", count: inPeriod.filter((row) => inTab(row, "DRAFT")).length },
            { value: "IMPORT", label: ar ? "الاستيراد" : "Import invoices", count: inPeriod.filter((row) => inTab(row, "IMPORT")).length },
          ]} />
          <FilterChips label={ar ? "الفترة" : "Period"} options={datePresetOptions(ar)} value={period} onChange={setPeriod} />
        </>}
        totals={(list) => [
          { key: "count", label: ar ? "الفواتير" : "Invoices", value: list.length },
          { key: "total", label: ar ? "الإجمالي" : "Total", value: <Money value={sumBy(list, (row) => row.total)} symbol={currencySymbol} /> },
        ]}
        onRowActivate={(x) => x.purchaseType === "IMPORT" ? onImport?.(x.purchaseId) : void purchaseDetail.openDetail(x.purchaseId)}
        rowActions={(x) => (
          <div className="purchase-row-actions">
            <IconButton label={x.purchaseType === "IMPORT" ? (ar ? "فتح الاستيراد" : "Open import") : (ar ? "عرض" : "View")} onClick={() => x.purchaseType === "IMPORT" ? onImport?.(x.purchaseId) : void purchaseDetail.openDetail(x.purchaseId)}><Icon name="view" size={18} /></IconButton>
            <IconButton label={ar ? "طباعة" : "Print"} onClick={() => void printPurchase(x.purchaseId)}><Icon name="document" size={18} /></IconButton>
            {x.status === "DRAFT" ? <>
              {x.purchaseType !== "IMPORT" && <IconButton label={ar ? "تأكيد الفاتورة" : "Confirm invoice"} onClick={() => void confirmDraft(x.purchaseId)}><Icon name="enable" size={18} /></IconButton>}
              <IconButton label={ar ? "إلغاء الفاتورة" : "Cancel invoice"} onClick={() => void cancelDraft(x.purchaseId)}><Icon name="disable" size={18} /></IconButton>
            </> : <IconButton label={ar ? "إرجاع" : "Return"} onClick={() => setError(ar ? "سيتم طلب اعتماد الإرجاع من مستخدم ذي صلاحية أعلى." : "Return approval is required from a higher-privilege user.")}><Icon name="swap" size={18} /></IconButton>}
          </div>
        )}
        emptyTitle={ar ? "لا توجد فواتير" : "No invoices"}
        emptyDetail={ar ? "لا توجد فواتير في هذا التبويب أو الفترة." : "There are no invoices in this tab or period."}
      />
      <PurchaseDetailModal ar={ar} state={purchaseDetail} />
    </div>
  );
}
