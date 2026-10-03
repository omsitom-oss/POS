import { useEffect, useMemo, useState } from "react";
import {
  Button,
  ErrorState,
  FormField,
  IconButton,
  LoadingState,
  Modal,
  Select,
  StatusBadge,
  TableFooter,
  TextInput,
} from "../../components/shared";
import { PageHeader, type Locale } from "../../layouts/AppLayout";
import { Icon } from "../../components/icons";

type Supplier = {
  partnerId: number;
  customerCode?: string;
  businessName?: string;
  partnerName?: string;
  partnerTypeCode?: string;
};
type Item = {
  itemId: number;
  nameAr: string;
  nameEn: string;
  sellPrice: number;
  lastPurchasePrice?: number | null;
};
type Purchase = {
  purchaseId: number;
  invoiceNo: string;
  purchaseDate: string;
  supplierName: string;
  status: string;
  currencyCode: string;
  currencySymbol: string;
  total: number;
  lineCount: number;
  purchaseType: string;
};
type PurchaseDetail = Purchase & {
  currencySymbol: string;
  discount: number;
  description?: string | null;
  lines: Array<{
    purchaseLineId: number;
    itemId: number;
    itemName: string;
    unitName?: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    expiryDate?: string | null;
    barcode?: string | null;
    batchNo?: string | null;
  }>;
};
type Currency = { currencyId: number; symbol: string; isPrimary: boolean; isActive: boolean };
type Unit = {
  unitSettingId: number;
  unitAr?: string;
  unitEn?: string;
  isBase: boolean;
  conversionToBase: number;
};
type Line = {
  itemId: string;
  unitSettingId: string;
  quantity: string;
  unitPrice: string;
  expiryDate: string;
  barcode: string;
  batchNo: string;
};
type DetailEdit = { expiryDate: string; barcode: string };

function formatAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString("en-US", { maximumFractionDigits: 6 })
    : value;
}
function formatPurchaseDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}
function escapePrint(value: unknown) {
  return String(value ?? "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

export function PurchasesPage({ locale, onImport }: { locale: Locale; onImport?: (purchaseId?: number) => void }) {
  const ar = locale === "ar";
  const [rows, setRows] = useState<Purchase[]>([]),
    [suppliers, setSuppliers] = useState<Supplier[]>([]),
    [items, setItems] = useState<Item[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<"POSTED" | "DRAFT" | "IMPORT">("POSTED");
  const [detail, setDetail] = useState<PurchaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailEdits, setDetailEdits] = useState<Record<number, DetailEdit>>({});
  const [supplierId, setSupplierId] = useState(""),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [discount, setDiscount] = useState("0"),
    [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [currencyId, setCurrencyId] = useState<number | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState("SDG");
  const [units, setUnits] = useState<Record<string, Unit[]>>({});
  const [itemModal, setItemModal] = useState(false);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [unitPriceFocused, setUnitPriceFocused] = useState(false);
  const [itemDraft, setItemDraft] = useState<Line>({
    itemId: "",
    unitSettingId: "",
    quantity: "1",
    unitPrice: "0",
    expiryDate: "",
    barcode: "",
    batchNo: "",
  });
  async function load() {
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
  }
  useEffect(() => {
    void load();
  }, []);
  const subtotal = useMemo(
      () =>
        lines.reduce(
          (s, l) =>
            s +
            Math.max(0, Number(l.quantity) || 0) *
              Math.max(0, Number(l.unitPrice) || 0),
          0,
        ),
      [lines],
    ),
    grandTotal = Math.max(0, subtotal - (Number(discount) || 0));
  const visibleRows = rows.filter((row) => activeTab === "IMPORT" ? row.purchaseType === "IMPORT" : row.purchaseType !== "IMPORT" && row.status === activeTab);
  function update(i: number, k: keyof Line, v: string) {
    setLines((x) => x.map((l, n) => (n === i ? { ...l, [k]: v } : l)));
  }
  async function choose(i: number, v: string) {
    const item = items.find((x) => String(x.itemId) === v);
    const duplicateIndex = lines.findIndex((line, index) => index !== i && line.itemId === v);
    if (v && duplicateIndex >= 0) {
      if (window.confirm(ar ? "هذا العنصر موجود بالفعل. هل تريد تعديل بياناته؟" : "This item already exists. Do you want to edit it?")) void openEditItemModal(duplicateIndex);
      return;
    }
    setLines((x) =>
      x.map((l, n) =>
        n === i
          ? {
              ...l,
              itemId: v,
              unitSettingId: "",
              unitPrice:
                item && Number(l.unitPrice) === 0
                  ? String(item.sellPrice ?? 0)
                  : l.unitPrice,
            }
          : l,
      ),
    );
    if (v && !units[v]) {
      const response = await fetch(`/api/items/${v}`);
      if (response.ok) {
        const details = await response.json();
        setUnits((x) => ({ ...x, [v]: details.units ?? [] }));
      }
    }
  }
  function openItemModal() {
    setItemSearch("");
    setItemPickerOpen(false);
    setItemDraft({
      itemId: "",
      unitSettingId: "",
      quantity: "1",
      unitPrice: "0",
      expiryDate: "",
      barcode: "",
      batchNo: "",
    });
    setUnitPriceFocused(false);
    setEditingLineIndex(null);
    setItemModal(true);
  }
  async function openEditItemModal(index: number) {
    const line = lines[index];
    let itemUnits = units[line.itemId] ?? [];
    if (!itemUnits.length) {
      const response = await fetch(`/api/items/${line.itemId}`);
      if (response.ok) {
        const details = await response.json();
        itemUnits = details.units ?? [];
        setUnits((x) => ({ ...x, [line.itemId]: itemUnits }));
      }
    }
    setItemSearch("");
    setItemPickerOpen(false);
    setUnitPriceFocused(false);
    setEditingLineIndex(index);
    setItemDraft({ ...line });
    setItemModal(true);
  }
  async function chooseDraftItem(value: string) {
    const item = items.find((x) => String(x.itemId) === value);
    let itemUnits = units[value] ?? [];
    if (value && !itemUnits.length) {
      const response = await fetch(`/api/items/${value}`);
      if (response.ok) {
        const details = await response.json();
        itemUnits = details.units ?? [];
        setUnits((x) => ({ ...x, [value]: itemUnits }));
      }
    }
    const base = itemUnits.find((x: Unit) => x.isBase) ?? itemUnits[0];
    setItemDraft((x) => ({
      ...x,
      itemId: value,
      unitSettingId: base ? String(base.unitSettingId) : "",
      unitPrice: String(item?.lastPurchasePrice ?? item?.sellPrice ?? 0),
    }));
  }
  function chooseDraftUnit(value: string) {
    const itemUnits = units[itemDraft.itemId] ?? [];
    const selected = itemUnits.find((x) => String(x.unitSettingId) === value);
    const item = items.find((x) => String(x.itemId) === itemDraft.itemId);
    setItemDraft((x) => ({
      ...x,
      unitSettingId: value,
      unitPrice:
        selected && item
          ? String(
              (item.lastPurchasePrice ?? item.sellPrice) *
                selected.conversionToBase,
            )
          : x.unitPrice,
    }));
  }
  function addDraftItem() {
    if (
      !itemDraft.itemId ||
      !itemDraft.unitSettingId ||
      Number(itemDraft.quantity) <= 0 ||
      Number(itemDraft.unitPrice) < 0
    )
      return;
    const selectedUnit = (units[itemDraft.itemId] ?? []).find((unit) => String(unit.unitSettingId) === itemDraft.unitSettingId);
    const baseUnit = (units[itemDraft.itemId] ?? []).find((unit) => unit.isBase);
    const conversion = selectedUnit?.conversionToBase ?? 1;
    const baseLine: Line = {
      ...itemDraft,
      unitSettingId: baseUnit ? String(baseUnit.unitSettingId) : itemDraft.unitSettingId,
      quantity: String((Number(itemDraft.quantity) || 0) * conversion),
      unitPrice: String((Number(itemDraft.unitPrice) || 0) / conversion),
    };
    const duplicateIndex = lines.findIndex((line, index) => index !== editingLineIndex && line.itemId === baseLine.itemId);
    if (duplicateIndex >= 0) {
      if (!window.confirm(ar ? "هذا العنصر موجود بالفعل. هل تريد تعديل بياناته؟" : "This item already exists. Do you want to edit it?")) return;
      void openEditItemModal(duplicateIndex);
      return;
    }
    setLines((x) => editingLineIndex === null ? [...x, baseLine] : x.map((line, index) => index === editingLineIndex ? baseLine : line));
    setItemModal(false);
    setEditingLineIndex(null);
  }
  async function save(status: "DRAFT" | "POSTED") {
    if (
      !supplierId ||
      lines.length === 0 ||
      lines.some(
        (l) =>
          !l.itemId ||
          !l.unitSettingId ||
          Number(l.quantity) <= 0 ||
          Number(l.unitPrice) < 0,
      ) ||
      Number(discount) < 0 ||
      Number(discount) > subtotal
    ) {
      setError(
        ar
          ? "أكمل بيانات الفاتورة وتحقق من الخصم."
          : "Complete the invoice and check the discount.",
      );
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierPartnerId: Number(supplierId),
          purchaseDate: date,
          status,
          currencyId: currencyId ?? 0,
          description: notes,
          discount: Number(discount),
          lines: lines.map((l) => ({
            itemId: Number(l.itemId),
            unitSettingId: l.unitSettingId ? Number(l.unitSettingId) : null,
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
            expiryDate: l.expiryDate || null,
            barcode: l.barcode || null,
            batchNo: l.batchNo || null,
          })),
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      setEditing(false);
      setLines([]);
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : ar
            ? "تعذر حفظ الفاتورة."
            : "Could not save invoice.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function openDetail(purchaseId: number) {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/purchases/${purchaseId}`);
      if (!response.ok) throw new Error(await response.text());
      const loaded = (await response.json()) as PurchaseDetail;
      setDetail(loaded);
      setDetailEdits(Object.fromEntries(loaded.lines.map((line) => [line.purchaseLineId, {
        expiryDate: line.expiryDate ? line.expiryDate.slice(0, 10) : "",
        barcode: line.barcode ?? "",
      }])));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : ar ? "تعذر تحميل التفاصيل." : "Could not load details.");
    } finally {
      setDetailLoading(false);
    }
  }
  async function saveDetailMetadata() {
    if (!detail) return;
    setDetailSaving(true);
    try {
      const updates = await Promise.all(detail.lines.map((line) => {
        const edit = detailEdits[line.purchaseLineId] ?? { expiryDate: "", barcode: "" };
        return fetch(`/api/purchases/${detail.purchaseId}/lines/${line.purchaseLineId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiryDate: edit.expiryDate || null, barcode: edit.barcode || null }),
        });
      }));
      const failed = updates.find((response) => !response.ok);
      if (failed) throw new Error(await failed.text());
      await openDetail(detail.purchaseId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : ar ? "تعذر حفظ بيانات العناصر." : "Could not save item metadata.");
    } finally {
      setDetailSaving(false);
    }
  }
  async function printPurchase(purchaseId: number) {
    const windowRef = window.open("", "_blank", "width=1100,height=900");
    if (!windowRef) return;
    try {
      const [detailResponse, profileResponse] = await Promise.all([fetch(`/api/purchases/${purchaseId}`), fetch("/api/company-profile")]);
      if (!detailResponse.ok) throw new Error(await detailResponse.text());
      const purchase = (await detailResponse.json()) as PurchaseDetail;
      const profile = profileResponse.ok ? await profileResponse.json() as { companyName?: string; companyAddress?: string; companyPhone1?: string; companyPhone2?: string; companyMobileNo?: string; companyFax?: string; logoBase64?: string | null; logoContentType?: string | null } : null;
      const logo = profile?.logoBase64 && profile.logoContentType ? `<img class="logo" src="data:${escapePrint(profile.logoContentType)};base64,${profile.logoBase64}" />` : "";
      const rows = purchase.lines.map((line, index) => `<tr><td>${index + 1}</td><td>${escapePrint(line.itemName)}</td><td>${escapePrint(line.unitName)}</td><td>${line.quantity.toLocaleString()}</td><td>${line.unitPrice.toLocaleString()} ${escapePrint(purchase.currencySymbol)}</td><td>${line.lineTotal.toLocaleString()} ${escapePrint(purchase.currencySymbol)}</td></tr>`).join("");
      windowRef.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapePrint(purchase.invoiceNo)}</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#102548;background:#fff;font:15px Arial,sans-serif}.toolbar{display:flex;justify-content:center;gap:10px;padding:12px;background:#17212b}.toolbar button{padding:9px 22px;border:0;border-radius:6px;cursor:pointer}.page{padding:5px 2mm}.header{display:flex;align-items:flex-start;justify-content:space-between;gap:26px}.brand{display:flex;align-items:center;gap:16px}.logo{width:110px;height:82px;object-fit:contain}.brand h1{margin:0;font-size:34px;color:#12284a}.contact{font-size:15px;line-height:1.7;text-align:right}.rule{border-top:2px solid #12284a;margin:8px 0 25px}.title{text-align:center}.title h2{display:inline-block;margin:0;padding:10px 42px;border-radius:14px;color:#fff;background:#102b55;font-size:28px}.title p{margin:4px 0 18px;font-size:17px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin:0 6% 26px;font-size:17px}.meta section{display:grid;gap:9px}.meta div{display:flex;gap:14px}.meta b{min-width:110px}.status{display:inline-block;width:max-content;padding:5px 18px;border-radius:12px;color:#168b67;background:#dff6ed;font-weight:700}.table{width:100%;border-collapse:collapse;border-top:1.5px solid #12284a;border-bottom:1.5px solid #12284a}.table th{padding:11px 8px;background:#eaf2fb;font-size:16px}.table td{padding:13px 8px;border-bottom:1px solid #b9c6d5;text-align:center}.table td:nth-child(2){text-align:right}.summary{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:28px}.notes{min-height:100px;border:1px solid #c2d0df;border-radius:10px;padding:12px}.totals{display:grid;grid-template-columns:1fr auto;gap:12px;font-size:17px}.grand{padding:13px;border-radius:10px;background:#eaf2fb;font-size:20px;font-weight:700}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:90px;margin-top:85px;text-align:center}.signature{border-top:2px solid #12284a;padding-top:10px}@media print{.toolbar{display:none}}</style></head><body><div class="toolbar"><button onclick="window.print()">طباعة</button><button onclick="window.close()">إغلاق</button></div><main class="page"><header class="header"><div class="brand">${logo}<div><h1>${escapePrint(profile?.companyName || "الشركة")}</h1></div></div><div class="contact">${escapePrint(profile?.companyAddress)}<br>هاتف: ${escapePrint(profile?.companyPhone1 || profile?.companyMobileNo)}<br>فاكس: ${escapePrint(profile?.companyPhone2 || profile?.companyFax)}</div></header><div class="rule"></div><div class="title"><h2>فاتورة شراء</h2><p>Purchase Invoice</p></div><div class="meta"><section><div><b>رقم الفاتورة:</b><span>${escapePrint(purchase.invoiceNo)}</span></div><div><b>التاريخ:</b><span>${escapePrint(purchase.purchaseDate.slice(0,10))}</span></div><div><b>حالة الفاتورة:</b><span class="status">${purchase.status === "POSTED" ? "معتمدة" : "مبدئية"}</span></div></section><section><div><b>المورد:</b><span>${escapePrint(purchase.supplierName)}</span></div><div><b>العملة:</b><span>${escapePrint(purchase.currencySymbol)}</span></div><div><b>طريقة الدفع:</b><span>نقداً</span></div></section></div><table class="table"><thead><tr><th>#</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table><div class="summary"><div><b>ملاحظات:</b><div class="notes">${escapePrint(purchase.description || "—")}</div></div><div class="totals"><span>المجموع الفرعي:</span><span>${(purchase.total + purchase.discount).toLocaleString()} ${escapePrint(purchase.currencySymbol)}</span><span>الخصم:</span><span>${purchase.discount.toLocaleString()} ${escapePrint(purchase.currencySymbol)}</span><strong class="grand">المجموع الكلي: ${purchase.total.toLocaleString()} ${escapePrint(purchase.currencySymbol)}</strong><strong class="grand"></strong></div></div><div class="signatures"><div class="signature">توقيع المورد</div><div class="signature">توقيع المشتري</div></div></main></body></html>`);
      windowRef.document.close();
    } catch (reason) { windowRef.document.body.innerHTML = `<p style="padding:24px;font:16px Arial">${escapePrint(reason instanceof Error ? reason.message : "تعذر تجهيز الفاتورة للطباعة.")}</p>`; }
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
      <div
        className="settings-page purchase-editor-page"
        dir={ar ? "rtl" : "ltr"}
      >
        <PageHeader
          eyebrow={ar ? "المشتريات" : "PURCHASES"}
          title={ar ? "فاتورة شراء جديدة" : "New purchase invoice"}
          description={
            ar
              ? "أضف عدة أصناف ثم احفظها كمسودة أو رحّلها نهائياً."
              : "Add multiple items, then save as draft or post the invoice."
          }
          actions={
            <Button variant="ghost" onClick={() => setEditing(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
          }
        />
        {error && (
          <ErrorState
            title={ar ? "تعذر الحفظ" : "Could not save"}
            detail={error}
          />
        )}
        <div className="purchase-editor-grid">
          <main>
            <section className="purchase-lines-card">
              <div className="purchase-fields-grid">
                <FormField label={ar ? "المورد" : "Supplier"} required>
                  <div className="purchase-item-picker">
                    <TextInput
                      value={
                        supplierSearch ||
                        (supplierId
                          ? (suppliers.find(
                              (supplier) => String(supplier.partnerId) === supplierId,
                            )?.businessName ?? "")
                          : "")
                      }
                      placeholder={ar ? "ابحث أو اختر المورد" : "Search or select supplier"}
                      onFocus={() => setSupplierPickerOpen(true)}
                      onChange={(event) => {
                        setSupplierSearch(event.target.value);
                        setSupplierPickerOpen(true);
                        setSupplierId("");
                      }}
                    />
                    {supplierPickerOpen && (
                      <div className="purchase-item-options purchase-supplier-options">
                        {suppliers
                          .filter((supplier) => {
                            const name = supplier.businessName ?? supplier.partnerName ?? `#${supplier.partnerId}`;
                            return !supplierSearch || name.toLowerCase().includes(supplierSearch.toLowerCase());
                          })
                          .map((supplier) => {
                            const name = supplier.businessName ?? supplier.partnerName ?? `#${supplier.partnerId}`;
                            return (
                              <button
                                type="button"
                                key={supplier.partnerId}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setSupplierId(String(supplier.partnerId));
                                  setSupplierSearch(name);
                                  setSupplierPickerOpen(false);
                                }}
                              >
                                {name}
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </FormField>
                <FormField label={ar ? "التاريخ" : "Invoice date"} required>
                  <TextInput
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </FormField>
              </div>
              <div className="purchase-lines-head">
                <h3>{ar ? "العناصر" : "Items"}</h3>
                <Button variant="primary" size="small" onClick={openItemModal}>
                  ＋ {ar ? "إضافة صنف" : "Add item"}
                </Button>
              </div>
              <div className="purchase-lines-table">
                <div className="purchase-line-row purchase-line-header">
                  <span>#</span>
                  <span>{ar ? "الصنف" : "Item"}</span>
                  <span>{ar ? "الوحدة" : "Unit"}</span>
                  <span>{ar ? "الكمية" : "Qty"}</span>
                  <span>{ar ? "سعر الوحدة" : "Unit price"}</span>
                  <span>{ar ? "الإجمالي" : "Total"}</span>
                  <span />
                </div>
                {lines.map((line, index) => (
                  <div className="purchase-line-row" key={index}>
                    <span>{index + 1}</span>
                    <Select
                      value={line.itemId}
                      onChange={(e) => choose(index, e.target.value)}
                    >
                      <option value="">
                        {ar ? "اختر الصنف" : "Select item"}
                      </option>
                      {items.map((x) => (
                        <option key={x.itemId} value={x.itemId}>
                          {ar ? x.nameAr : x.nameEn}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={line.unitSettingId}
                      onChange={(e) =>
                        update(index, "unitSettingId", e.target.value)
                      }
                    >
                      <option value="">{ar ? "الوحدة" : "Unit"}</option>
                      {(units[line.itemId] ?? []).map((unit) => (
                        <option
                          key={unit.unitSettingId}
                          value={unit.unitSettingId}
                        >
                          {ar
                            ? (unit.unitAr ?? `وحدة ${unit.unitSettingId}`)
                            : (unit.unitEn ?? `Unit ${unit.unitSettingId}`)}
                        </option>
                      ))}
                    </Select>
                    <TextInput
                      type="number"
                      min="0.01"
                      value={line.quantity}
                      onChange={(e) =>
                        update(index, "quantity", e.target.value)
                      }
                    />
                    <TextInput
                      type="number"
                      min="0"
                      value={line.unitPrice}
                      onChange={(e) =>
                        update(index, "unitPrice", e.target.value)
                      }
                    />
                    <strong>
                      {(
                        (Number(line.quantity) || 0) *
                        (Number(line.unitPrice) || 0)
                      ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </strong>
                    <div className="purchase-line-actions">
                      <IconButton label={ar ? "تعديل العنصر" : "Edit item"} onClick={() => void openEditItemModal(index)}><Icon name="edit" size={16} /></IconButton>
                      <button
                        className="purchase-remove-line"
                        disabled={lines.length === 1}
                        onClick={() => setLines((x) => x.filter((_, n) => n !== index))}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <FormField label={ar ? "ملاحظات" : "Notes"}>
                <textarea
                  className="purchase-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={ar ? "ملاحظات الفاتورة" : "Add notes…"}
                />
              </FormField>
            </section>
          </main>
          <aside className="purchase-summary-card">
            <h3>{ar ? "ملخص الفاتورة" : "Invoice summary"}</h3>
            <div>
              <span>{ar ? "إجمالي العناصر" : "Items total"}</span>
              <strong>
                {subtotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </strong>
            </div>
            <div className="purchase-discount-row">
              <span>{ar ? "الخصم" : "Discount"}</span>
              <div className="purchase-discount-controls">
                <div className="purchase-input-icon">
                  <Icon name="calculator" size={18} />
                  <TextInput
                    type="number"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </div>
                <div className="purchase-discount-presets" aria-label={ar ? "نسب الخصم" : "Discount percentages"}>
                  {[1, 5, 10].map((percent) => (
                    <button
                      type="button"
                      key={percent}
                      onClick={() => setDiscount(((subtotal * percent) / 100).toFixed(2))}
                    >
                      {percent}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="purchase-grand-total">
              <span>{ar ? "الإجمالي النهائي" : "Grand total"}</span>
              <strong>
                {grandTotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}{" "}
                {currencySymbol}
              </strong>
            </div>
            <div className="purchase-editor-actions">
              <Button
                variant="secondary"
                loading={saving}
                onClick={() => void save("DRAFT")}
              >
                {ar ? "فاتورة ابتدائية" : "Initial invoice"}
              </Button>
              <Button
                variant="primary"
                loading={saving}
                onClick={() => void save("POSTED")}
              >
                {ar ? "فاتورة نهائية" : "Final invoice"}
              </Button>
            </div>
          </aside>
        </div>
        <Modal
          open={itemModal}
          title={ar ? "إضافة عنصر إلى الفاتورة" : "Add item to invoice"}
          description={
            ar
              ? "أدخل تفاصيل العنصر لإضافته إلى فاتورة الشراء"
              : "Enter item details to add to the purchase invoice"
          }
          closeLabel={ar ? "إغلاق" : "Close"}
          onClose={() => { setItemModal(false); setEditingLineIndex(null); }}
          footer={
            <>
              <Button variant="ghost" onClick={() => { setItemModal(false); setEditingLineIndex(null); }}>
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button variant="primary" onClick={addDraftItem}>
                {editingLineIndex === null ? (ar ? "إضافة" : "Add item") : (ar ? "حفظ التعديل" : "Save changes")}
              </Button>
            </>
          }
        >
          <div className="purchase-item-modal-form">
            <FormField label={ar ? "العنصر" : "Item"} required>
              <div className="purchase-item-picker">
                <TextInput
                  value={
                    itemSearch ||
                    (itemDraft.itemId
                      ? (items.find(
                          (item) => String(item.itemId) === itemDraft.itemId,
                        )?.[ar ? "nameAr" : "nameEn"] ?? "")
                      : "")
                  }
                  placeholder={
                    ar ? "ابحث أو اختر العنصر" : "Search or select item"
                  }
                  onFocus={() => setItemPickerOpen(true)}
                  onChange={(event) => {
                    setItemSearch(event.target.value);
                    setItemPickerOpen(true);
                  }}
                />
                {itemPickerOpen && (
                  <div className="purchase-item-options">
                    {items
                      .filter(
                        (item) =>
                          !itemSearch ||
                          (ar ? item.nameAr : item.nameEn)
                            .toLowerCase()
                            .includes(itemSearch.toLowerCase()),
                      )
                      .map((item) => (
                        <button
                          type="button"
                          key={item.itemId}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            void chooseDraftItem(String(item.itemId));
                            setItemSearch(ar ? item.nameAr : item.nameEn);
                            setItemPickerOpen(false);
                          }}
                        >
                          {ar ? item.nameAr : item.nameEn}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </FormField>
            <FormField label={ar ? "الوحدة" : "Unit"} required>
              <Select
                value={itemDraft.unitSettingId}
                onChange={(e) => chooseDraftUnit(e.target.value)}
                disabled={!itemDraft.itemId}
              >
                <option value="">{ar ? "اختر الوحدة" : "Select unit"}</option>
                {(units[itemDraft.itemId] ?? []).map((unit) => (
                  <option key={unit.unitSettingId} value={unit.unitSettingId}>
                    {ar ? unit.unitAr : unit.unitEn}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={ar ? "الكمية" : "Quantity"} required>
              <div className="purchase-input-icon">
                <Icon name="calculator" size={18} />
                <TextInput
                  type="number"
                  min="0.01"
                  value={itemDraft.quantity}
                  onChange={(e) =>
                    setItemDraft((x) => ({ ...x, quantity: e.target.value }))
                  }
                />
              </div>
            </FormField>
            <FormField label={ar ? "سعر الوحدة" : "Unit price"} required>
              <div className="purchase-input-icon purchase-money-input">
                <Icon name="coins" size={18} />
                <TextInput
                  type="text"
                  inputMode="decimal"
                  min="0"
                  value={
                    unitPriceFocused
                      ? itemDraft.unitPrice
                      : formatAmount(itemDraft.unitPrice)
                  }
                  onFocus={() => setUnitPriceFocused(true)}
                  onBlur={() => setUnitPriceFocused(false)}
                  onChange={(e) =>
                    setItemDraft((x) => ({
                      ...x,
                      unitPrice: e.target.value.replace(/,/g, ""),
                    }))
                  }
                />
                <span className="purchase-currency">{currencySymbol}</span>
              </div>
            </FormField>
            <FormField label={ar ? "إجمالي العنصر" : "Line total"}>
              <div className="purchase-input-icon purchase-money-input">
                <Icon name="sum" size={18} />
                <TextInput
                  readOnly
                  value={(
                    (Number(itemDraft.quantity) || 0) *
                    (Number(itemDraft.unitPrice) || 0)
                  ).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                />
                <span className="purchase-currency">{currencySymbol}</span>
              </div>
            </FormField>
            <FormField label={ar ? "تاريخ الانتهاء" : "Expiry date"}>
              <TextInput
                type="date"
                value={itemDraft.expiryDate}
                onChange={(e) =>
                  setItemDraft((x) => ({ ...x, expiryDate: e.target.value }))
                }
              />
            </FormField>
            <FormField label={ar ? "الباركود" : "Barcode"}>
              <div className="purchase-input-icon">
                <Icon name="barcode" size={18} />
                <TextInput
                  value={itemDraft.barcode}
                  onChange={(e) =>
                    setItemDraft((x) => ({ ...x, barcode: e.target.value }))
                  }
                />
              </div>
            </FormField>
          </div>
        </Modal>
      </div>
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
              ＋ {ar ? "استيراد بضاعة" : "Import goods"}
            </Button>
            <Button variant="primary" onClick={() => setEditing(true)}>
              ＋ {ar ? "فاتورة جديدة" : "New invoice"}
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
        <button type="button" className={activeTab === "POSTED" ? "is-active" : ""} onClick={() => setActiveTab("POSTED")}>
          {ar ? "الفواتير النهائية" : "Final invoices"}
        </button>
        <button type="button" className={activeTab === "DRAFT" ? "is-active" : ""} onClick={() => setActiveTab("DRAFT")}>
          {ar ? "الفواتير المبدئية" : "Initial invoices"}
        </button>
        <button type="button" className={activeTab === "IMPORT" ? "is-active" : ""} onClick={() => setActiveTab("IMPORT")}>
          {ar ? "فواتير الاستيراد" : "Import invoices"}
        </button>
      </div>
      {loading ? (
        <LoadingState />
      ) : (
        <div className="currency-table-wrap">
          <table className="currency-table">
            <thead>
              <tr>
                <th>{ar ? "رقم الفاتورة" : "Invoice"}</th>
                <th>{ar ? "التاريخ" : "Date"}</th>
                <th>{ar ? "المورد" : "Supplier"}</th>
                <th>{ar ? "الحالة" : "Status"}</th>
                <th>{ar ? "الإجمالي" : "Total"}</th>
                <th>{ar ? "العناصر" : "Items"}</th>
                <th>{ar ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((x) => (
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
                  <td>
                    {x.total.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}{" "}
                    {x.currencySymbol}
                  </td>
                  <td>{x.lineCount}</td>
                  <td>
                    <div className="purchase-row-actions">
                      <IconButton label={x.purchaseType === "IMPORT" ? (ar ? "فتح الاستيراد" : "Open import") : (ar ? "عرض" : "View")} onClick={() => x.purchaseType === "IMPORT" ? onImport?.(x.purchaseId) : void openDetail(x.purchaseId)}><Icon name="view" size={18} /></IconButton>
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
          <TableFooter total={visibleRows.length} locale={locale} />
        </div>
      )}
      <Modal
        open={Boolean(detail)}
        title={detail ? `${ar ? "تفاصيل الفاتورة" : "Purchase invoice"} ${detail.invoiceNo}` : ""}
        description={detail ? (ar ? "عرض غير قابل للتعديل." : "Read-only purchase details.") : undefined}
        closeLabel={ar ? "إغلاق" : "Close"}
        onClose={() => setDetail(null)}
        footer={detail ? <><Button variant="secondary" loading={detailSaving} onClick={() => void saveDetailMetadata()}>{ar ? "حفظ التعديلات" : "Save changes"}</Button><Button variant="primary" onClick={() => void printPurchase(detail.purchaseId)}>{ar ? "طباعة" : "Print"}</Button></> : undefined}
      >
        {detailLoading || !detail ? <LoadingState /> : <div className="purchase-detail-sheet">
          <div className="purchase-detail-meta"><strong>{detail.supplierName}</strong><span>{formatPurchaseDate(detail.purchaseDate)}</span><StatusBadge tone={detail.status === "POSTED" ? "success" : "neutral"}>{detail.status === "POSTED" ? (ar ? "نهائية" : "Posted") : (ar ? "مبدئية" : "Draft")}</StatusBadge></div>
          <div className="purchase-detail-table-wrap"><table className="currency-table"><thead><tr><th>{ar ? "الصنف" : "Item"}</th><th>{ar ? "الوحدة" : "Unit"}</th><th>{ar ? "الكمية" : "Qty"}</th><th>{ar ? "سعر الوحدة" : "Unit price"}</th><th>{ar ? "الإجمالي" : "Total"}</th><th>{ar ? "تاريخ الانتهاء" : "Expiry date"}</th><th>{ar ? "الباركود" : "Barcode"}</th></tr></thead><tbody>{detail.lines.map((line) => { const edit = detailEdits[line.purchaseLineId] ?? { expiryDate: line.expiryDate ? line.expiryDate.slice(0, 10) : "", barcode: line.barcode ?? "" }; return <tr key={line.purchaseLineId}><td>{line.itemName}</td><td>{line.unitName ?? "—"}</td><td>{line.quantity}</td><td>{line.unitPrice.toLocaleString()} {detail.currencySymbol}</td><td>{line.lineTotal.toLocaleString()} {detail.currencySymbol}</td><td><input className="text-input purchase-detail-edit-input" type="date" value={edit.expiryDate} onChange={(event) => setDetailEdits((current) => ({ ...current, [line.purchaseLineId]: { ...edit, expiryDate: event.target.value } }))} /></td><td><input className="text-input purchase-detail-edit-input" value={edit.barcode} maxLength={100} onChange={(event) => setDetailEdits((current) => ({ ...current, [line.purchaseLineId]: { ...edit, barcode: event.target.value } }))} /></td></tr>; })}</tbody></table></div>
          <div className="purchase-detail-total"><span>{ar ? "الخصم" : "Discount"}</span><strong>{detail.discount.toLocaleString()} {detail.currencySymbol}</strong><span>{ar ? "الإجمالي" : "Total"}</span><strong>{detail.total.toLocaleString()} {detail.currencySymbol}</strong></div>
          {detail.description && <p className="purchase-detail-notes">{detail.description}</p>}
        </div>}
      </Modal>
    </div>
  );
}
