import { useCallback, useState } from "react";
import {
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  StatusBadge,
  TableFooter,
  Money,
} from "../../components/shared";
import { useLoadEffect } from "../../components/useLoadEffect";
import { usePagination } from "../../components/usePagination";
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
  const visibleRows = rows.filter((row) => activeTab === "IMPORT" ? row.purchaseType === "IMPORT" : row.purchaseType !== "IMPORT" && row.status === activeTab);
  const { rows: pageRows, pager, resetPage } = usePagination(visibleRows);
  function showTab(tab: typeof activeTab) {
    setActiveTab(tab);
    resetPage();
  }
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
        eyebrow={ar ? "المشتريات" : "PURCHASES"}
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
      )}{" "}
      <div className="purchase-tabs" role="tablist">
        <button type="button" className={activeTab === "POSTED" ? "is-active" : ""} onClick={() => showTab("POSTED")}>
          {ar ? "الفواتير النهائية" : "Final invoices"}
        </button>
        <button type="button" className={activeTab === "DRAFT" ? "is-active" : ""} onClick={() => showTab("DRAFT")}>
          {ar ? "الفواتير المبدئية" : "Initial invoices"}
        </button>
        <button type="button" className={activeTab === "IMPORT" ? "is-active" : ""} onClick={() => showTab("IMPORT")}>
          {ar ? "فواتير الاستيراد" : "Import invoices"}
        </button>
      </div>
      {loading ? (
        <LoadingState />
      ) : !visibleRows.length ? (
        <EmptyState title={ar ? "لا توجد فواتير هنا بعد." : "No invoices here yet."} detail={ar ? "أنشئ فاتورة شراء لتظهر في هذه القائمة." : "Create a purchase invoice and it will appear in this list."} />
      ) : (
        <div className="currency-table-wrap">
          <table className="currency-table">
            <thead>
              <tr>
                <th>{ar ? "رقم الفاتورة" : "Invoice"}</th>
                <th>{ar ? "التاريخ" : "Date"}</th>
                <th>{ar ? "المورد" : "Supplier"}</th>
                <th>{ar ? "الحالة" : "Status"}</th>
                <th className="num-cell">{ar ? "الإجمالي" : "Total"}</th>
                <th>{ar ? "العناصر" : "Items"}</th>
                <th>{ar ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((x) => (
                <tr key={x.purchaseId}>
                  <td>
                    <code>{x.invoiceNo}</code>
                  </td>
                  <td>{formatPurchaseDate(x.purchaseDate)}</td>
                  <td>{x.supplierName}</td>
                  <td>
                    <StatusBadge
                      tone={x.status === "POSTED" ? "success" : "neutral"}
                    >
                      {x.status === "POSTED"
                        ? ar
                          ? "نهائية"
                          : "Posted"
                        : ar
                          ? "مسودة"
                          : "Draft"}
                    </StatusBadge>
                  </td>
                  <td className="num-cell">
                    <Money value={x.total} symbol={x.currencySymbol} />
                  </td>
                  <td>{x.lineCount}</td>
                  <td>
                    <div className="purchase-row-actions">
                      <IconButton label={x.purchaseType === "IMPORT" ? (ar ? "فتح الاستيراد" : "Open import") : (ar ? "عرض" : "View")} onClick={() => x.purchaseType === "IMPORT" ? onImport?.(x.purchaseId) : void purchaseDetail.openDetail(x.purchaseId)}><Icon name="view" size={18} /></IconButton>
                      <IconButton label={ar ? "طباعة" : "Print"} onClick={() => void printPurchase(x.purchaseId)}><Icon name="document" size={18} /></IconButton>
                      {x.status === "DRAFT" ? <>
                        {x.purchaseType !== "IMPORT" && <IconButton label={ar ? "تأكيد الفاتورة" : "Confirm invoice"} onClick={() => void confirmDraft(x.purchaseId)}><Icon name="enable" size={18} /></IconButton>}
                        <IconButton label={ar ? "إلغاء الفاتورة" : "Cancel invoice"} onClick={() => void cancelDraft(x.purchaseId)}><Icon name="disable" size={18} /></IconButton>
                      </> : <IconButton label={ar ? "إرجاع" : "Return"} onClick={() => setError(ar ? "سيتم طلب اعتماد الإرجاع من مستخدم ذي صلاحية أعلى." : "Return approval is required from a higher-privilege user.")}><Icon name="swap" size={18} /></IconButton>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TableFooter total={visibleRows.length} locale={locale} pager={pager} />
        </div>
      )}
      <PurchaseDetailModal ar={ar} state={purchaseDetail} />
    </div>
  );
}
