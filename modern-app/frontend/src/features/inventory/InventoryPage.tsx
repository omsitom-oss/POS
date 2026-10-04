import { useCallback, useState } from "react";
import { Button, ErrorState, FilterChips, FormField, IconButton, LoadingState, Modal, Money, StatusBadge, TextInput } from "../../components/shared";
import { DataTable, type TableColumn } from "../../components/DataTable";
import { formatDay, formatNumber } from "../../app/formatters";
import { useLoadEffect } from "../../components/useLoadEffect";
import { PageHeader, type Locale } from "../../layouts/AppLayout";
import { Icon } from "../../components/icons";

type InventoryItem = { itemId: number; itemCode: string; nameAr: string; nameEn: string; baseUnitAr?: string | null; baseUnitEn?: string | null; quantity: number; sellPrice: number; lastPurchasePrice?: number | null; minimumLevelForAlert: number; isActive: boolean };
type Batch = { purchaseLineId: number; invoiceNo: string; purchaseDate: string; barcode?: string | null; expiryDate?: string | null; batchNo: string; quantity: number; availableQuantity: number; unitCost: number };

export function InventoryPage({ locale, branchId, branchName, userId }: { locale: Locale; branchId: number; branchName: string; userId: number }) {
  const ar = locale === "ar";
  const [rows, setRows] = useState<InventoryItem[]>([]), [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all"), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [batchItem, setBatchItem] = useState<InventoryItem | null>(null), [batches, setBatches] = useState<Batch[]>([]), [batchLoading, setBatchLoading] = useState(false);
  const [disposalBatch, setDisposalBatch] = useState<{ item: InventoryItem; batch: Batch } | null>(null), [disposalQty, setDisposalQty] = useState(""), [disposalReason, setDisposalReason] = useState(""), [disposalSaving, setDisposalSaving] = useState(false);

  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await fetch(`/api/inventory?branchId=${branchId}`); if (!response.ok) throw new Error(await response.text()); setRows(await response.json() as InventoryItem[]); } catch (reason) { setError(reason instanceof Error ? reason.message : (ar ? "تعذر تحميل المخزون." : "Could not load inventory.")); } finally { setLoading(false); } }, [ar, branchId])
  useLoadEffect(load);
  const format = (value: number) => formatNumber(value, "en", 3);
  const date = (value?: string | null) => formatDay(value);
  const isOut = (item: InventoryItem) => item.quantity <= 0;
  const isLow = (item: InventoryItem) => item.quantity > 0 && item.quantity <= item.minimumLevelForAlert;
  const visible = rows.filter(item => stockFilter === "all" || (stockFilter === "out" ? isOut(item) : isLow(item)));
  const status = (item: InventoryItem) => item.quantity <= 0 ? "danger" : item.quantity <= item.minimumLevelForAlert ? "warning" : "success";

  async function openBatches(item: InventoryItem) { setBatchItem(item); setBatches([]); setBatchLoading(true); try { const response = await fetch(`/api/inventory/${item.itemId}/batches?branchId=${branchId}`); if (!response.ok) throw new Error(await response.text()); setBatches(await response.json() as Batch[]); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load batches."); } finally { setBatchLoading(false); } }
  async function submitDisposal() { if (!disposalBatch || Number(disposalQty) <= 0 || !disposalReason.trim()) return; setDisposalSaving(true); try { const response = await fetch("/api/inventory/disposals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: disposalBatch.item.itemId, purchaseLineId: disposalBatch.batch.purchaseLineId, quantity: Number(disposalQty), reason: disposalReason.trim(), requestedBy: userId, branchId }) }); if (!response.ok) throw new Error(await response.text()); setDisposalBatch(null); setDisposalQty(""); setDisposalReason(""); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : (ar ? "تعذر إنشاء طلب الإتلاف." : "Could not create disposal request.")); } finally { setDisposalSaving(false); } }

  const stockLabel = (item: InventoryItem) => isOut(item) ? (ar ? "نفد" : "Out of stock") : isLow(item) ? (ar ? "منخفض" : "Low stock") : (ar ? "متوفر" : "In stock");
  const columns: Array<TableColumn<InventoryItem>> = [
    { key: "itemCode", title: ar ? "رمز الصنف" : "Item code", value: item => item.itemCode, render: item => <span className="doc-no">{item.itemCode}</span> },
    { key: "name", title: ar ? "الصنف" : "Item", value: item => ar ? item.nameAr : item.nameEn, searchValue: item => `${item.nameAr} ${item.nameEn}`, wrap: true, render: item => <strong className="cell-title">{ar ? item.nameAr : item.nameEn}</strong> },
    { key: "unit", title: ar ? "الوحدة الأساسية" : "Base unit", value: item => (ar ? item.baseUnitAr : item.baseUnitEn) ?? "—", searchable: false },
    { key: "quantity", title: ar ? "الكمية المتاحة" : "Available qty", value: item => item.quantity, align: "end", searchable: false, render: item => <strong className="numeric-value">{format(item.quantity)}</strong> },
    { key: "lastPurchasePrice", title: ar ? "آخر سعر شراء" : "Last purchase", value: item => item.lastPurchasePrice ?? -1, align: "end", searchable: false, render: item => item.lastPurchasePrice == null ? <span className="muted-cell">—</span> : <Money value={item.lastPurchasePrice} /> },
    { key: "sellPrice", title: ar ? "سعر البيع" : "Selling price", value: item => item.sellPrice, align: "end", searchable: false, render: item => <Money value={item.sellPrice} /> },
    { key: "status", title: ar ? "الحالة" : "Status", value: item => isOut(item) ? 0 : isLow(item) ? 1 : 2, searchable: false, render: item => <StatusBadge tone={status(item)}>{stockLabel(item)}</StatusBadge> },
  ];

  return <div className="settings-page inventory-page" dir={ar ? "rtl" : "ltr"}>
    <PageHeader title={ar ? "المخزن" : "Inventory"} description={ar ? `مخزون ${branchName}، والكميات بالوحدة الأساسية.` : `Stock at ${branchName}, quantities in the base unit.`} actions={<span className="inventory-branch-badge"><Icon name="inventory" size={17} />{branchName}</span>} />
    {error && <ErrorState title={ar ? "تعذر تنفيذ العملية" : "Operation failed"} detail={error} />}
    <DataTable
      locale={locale}
      columns={columns}
      rows={visible}
      rowKey={item => item.itemId}
      loading={loading}
      density="compact"
      pageSize={15}
      searchPlaceholder={ar ? "ابحث بالرمز أو اسم الصنف" : "Search by code or item name"}
      searchLabel={ar ? "بحث في المخزون" : "Search inventory"}
      filters={<FilterChips label={ar ? "حالة المخزون" : "Stock status"} value={stockFilter} onChange={setStockFilter} options={[
        { value: "all", label: ar ? "الكل" : "All", count: rows.length },
        { value: "low", label: ar ? "منخفض" : "Low stock", count: rows.filter(isLow).length },
        { value: "out", label: ar ? "نفد" : "Out of stock", count: rows.filter(isOut).length },
      ]} />}
      totals={list => [
        { key: "items", label: ar ? "الأصناف" : "Items", value: formatNumber(list.length, "en", 0) },
        { key: "low", label: ar ? "منخفض" : "Low stock", value: formatNumber(list.filter(isLow).length, "en", 0), tone: list.some(isLow) ? "warning" : "default" },
        { key: "out", label: ar ? "نفد" : "Out of stock", value: formatNumber(list.filter(isOut).length, "en", 0), tone: list.some(isOut) ? "danger" : "default" },
      ]}
      onRowActivate={item => void openBatches(item)}
      rowActions={item => <div className="inventory-row-actions"><IconButton label={ar ? "عرض الباتشات" : "View batches"} onClick={() => void openBatches(item)}><Icon name="view" size={17} /></IconButton><IconButton label={ar ? "طلب إتلاف" : "Request disposal"} onClick={() => void openBatches(item)}><Icon name="disable" size={17} /></IconButton></div>}
      emptyTitle={rows.length ? (ar ? "لا توجد نتائج" : "No results") : (ar ? "لا توجد أصناف في المخزن" : "No inventory items")}
      emptyDetail={rows.length ? undefined : (ar ? "ستظهر الكميات عند ترحيل فواتير الشراء." : "Quantities will appear when purchase invoices are posted.")}
    />
    <Modal open={Boolean(batchItem)} title={batchItem ? `${ar ? "باتشات الصنف" : "Item batches"} — ${ar ? batchItem.nameAr : batchItem.nameEn}` : ""} closeLabel={ar ? "إغلاق" : "Close"} onClose={() => setBatchItem(null)}>{batchLoading ? <LoadingState /> : <div className="currency-table-wrap inventory-batches-table"><table className="currency-table"><thead><tr><th>{ar ? "رقم الفاتورة" : "Invoice"}</th><th>{ar ? "تاريخ الشراء" : "Purchase date"}</th><th>{ar ? "الباركود" : "Barcode"}</th><th>{ar ? "تاريخ الانتهاء" : "Expiry"}</th><th>{ar ? "الكمية" : "Qty"}</th><th>{ar ? "المتاح" : "Available"}</th><th>{ar ? "رقم الباتش" : "Batch no."}</th><th>{ar ? "إتلاف" : "Dispose"}</th></tr></thead><tbody>{batches.map(batch => <tr key={batch.purchaseLineId}><td><span className="doc-no">{batch.invoiceNo}</span></td><td>{date(batch.purchaseDate)}</td><td>{batch.barcode || "—"}</td><td>{date(batch.expiryDate)}</td><td>{format(batch.quantity)}</td><td><strong>{format(batch.availableQuantity)}</strong></td><td>{batch.batchNo}</td><td><IconButton label={ar ? "طلب إتلاف هذا الباتش" : "Request disposal for this batch"} disabled={batch.availableQuantity <= 0} onClick={() => batchItem && setDisposalBatch({ item: batchItem, batch })}><Icon name="disable" size={17} /></IconButton></td></tr>)}</tbody></table></div>}</Modal>
    <Modal open={Boolean(disposalBatch)} title={ar ? "طلب إتلاف باتش" : "Request batch disposal"} description={ar ? "سيتم إنشاء طلب للموافقة قبل التأثير على المخزون والحسابات." : "A request will be created for approval before stock and accounts are affected."} closeLabel={ar ? "إغلاق" : "Close"} onClose={() => !disposalSaving && setDisposalBatch(null)} busy={disposalSaving} footer={<><Button variant="ghost" disabled={disposalSaving} onClick={() => setDisposalBatch(null)}>{ar ? "إلغاء" : "Cancel"}</Button><Button variant="danger" loading={disposalSaving} onClick={() => void submitDisposal()}>{ar ? "إرسال الطلب" : "Submit request"}</Button></>}><div className="settings-form"><FormField label={ar ? "الباتش" : "Batch"}><TextInput readOnly value={disposalBatch?.batch.batchNo ?? ""} /></FormField><FormField label={ar ? "الكمية" : "Quantity"} required><TextInput type="number" min="0.01" max={disposalBatch?.batch.availableQuantity} value={disposalQty} onChange={event => setDisposalQty(event.target.value)} /></FormField><FormField label={ar ? "سبب الإتلاف" : "Disposal reason"} required><textarea className="text-input" value={disposalReason} onChange={event => setDisposalReason(event.target.value)} maxLength={500} /></FormField></div></Modal>
  </div>;
}
