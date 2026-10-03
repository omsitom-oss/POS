import { useMemo, useState } from "react";
import { blankLine, type Item, type Line, type Unit } from "./purchaseModel";

type Options = {
  ar: boolean;
  items: Item[];
  currencyId: number | null;
  setError: (message: string) => void;
  /** Called after the invoice is stored; the page leaves the editor and reloads. */
  onSaved: () => Promise<void>;
};

/** State and actions of the new purchase invoice editor. Lives in the page so a cancelled draft is kept. */
export function usePurchaseEditor({ ar, items, currencyId, setError, onSaved }: Options) {
  const [saving, setSaving] = useState(false);
  const [supplierId, setSupplierId] = useState(""),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [discount, setDiscount] = useState("0"),
    [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [units, setUnits] = useState<Record<string, Unit[]>>({});
  const [itemModal, setItemModal] = useState(false);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [unitPriceFocused, setUnitPriceFocused] = useState(false);
  const [itemDraft, setItemDraft] = useState<Line>(blankLine);
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
    setItemDraft(blankLine);
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
      setLines([]);
      await onSaved();
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

  return {
    saving, supplierId, setSupplierId, date, setDate, discount, setDiscount, notes, setNotes,
    lines, setLines, units, itemModal, setItemModal, editingLineIndex, setEditingLineIndex,
    supplierSearch, setSupplierSearch, supplierPickerOpen, setSupplierPickerOpen,
    itemSearch, setItemSearch, itemPickerOpen, setItemPickerOpen, unitPriceFocused, setUnitPriceFocused,
    itemDraft, setItemDraft, subtotal, grandTotal,
    update, choose, openItemModal, openEditItemModal, chooseDraftItem, chooseDraftUnit, addDraftItem, save,
  };
}

export type PurchaseEditorState = ReturnType<typeof usePurchaseEditor>;
