import { useEffect, useState } from "react";
import { DataTable } from "../../components/DataTable";
import {
  Button,
  ErrorState,
  LoadingState,
  Modal,
  SwitchInput,
} from "../../components/shared";
import { Icon } from "../../components/icons";
import { PageHeader, type Locale } from "../../layouts/AppLayout";
import { itemColumns } from "./itemColumns";
import { ItemEditorTabs, type ItemEditorTab } from "./ItemEditorTabs";
import { ItemInfoPanel } from "./ItemInfoPanel";
import { blankDraft, draftFromItem, toItemPayload, unitDraftsFromDetails, type Draft, type Item, type ItemDetails, type ItemPriceHistory, type Setting, type UnitDraft } from "./itemModel";
import { ItemPriceHistoryPanel } from "./ItemPriceHistoryPanel";
import { ItemUnitsPanel } from "./ItemUnitsPanel";

export function ItemsPage({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const [rows, setRows] = useState<Item[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<Setting[]>([]);
  const [units, setUnits] = useState<Setting[]>([]);
  const [generics, setGenerics] = useState<Setting[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [saving, setSaving] = useState(false);
  const [primarySymbol, setPrimarySymbol] = useState("");
  const [editorTab, setEditorTab] = useState<ItemEditorTab>(
    "info",
  );
  const [priceHistory, setPriceHistory] = useState<ItemPriceHistory[]>([]);
  const [selectedUnit, setSelectedUnit] = useState(0);

  useEffect(() => {
    let active = true;
    fetch(`/api/items${showInactive ? "?includeInactive=true" : ""}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return response.json() as Promise<Item[]>;
      })
      .then((result) => {
        if (active) {
          setRows(result);
          setError("");
        }
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : ar
                ? "تعذر تحميل الأصناف."
                : "Could not load items.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ar, showInactive]);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/types/ITEM_CATEGORY/items?active=true").then(
        (response) =>
          response.ok ? (response.json() as Promise<Setting[]>) : [],
      ),
      fetch("/api/settings/types/UNIT/items?active=true").then((response) =>
        response.ok ? (response.json() as Promise<Setting[]>) : [],
      ),
      fetch("/api/settings/types/GENERIC/items?active=true").then((response) =>
        response.ok ? (response.json() as Promise<Setting[]>) : [],
      ),
    ])
      .then(([categoryRows, unitRows, genericRows]) => {
        setCategories(categoryRows);
        setUnits(unitRows);
        setGenerics(genericRows);
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    fetch("/api/currencies")
      .then((response) =>
        response.ok
          ? (response.json() as Promise<
              Array<{ isPrimary: boolean; symbol: string }>
            >)
          : [],
      )
      .then((currencies) =>
        setPrimarySymbol(
          currencies.find((currency) => currency.isPrimary)?.symbol ?? "",
        ),
      )
      .catch(() => setPrimarySymbol(""));
  }, []);

  async function open(item?: Item) {
    setEditorTab("info");
    setEditing(item ?? null);
    if (!item) {
      setPriceHistory([]);
      setSelectedUnit(0);
      setDraft({ ...blankDraft, units: [{ ...blankDraft.units[0] }] });
      setModal(true);
      setError("");
      return;
    }
    setDraft(draftFromItem(item));
    try {
      const response = await fetch(`/api/items/${item.itemId}`);
      if (response.ok) {
        const details = (await response.json()) as ItemDetails;
        const baseIndex = details.units.findIndex((unit) => unit.isBase);
        setSelectedUnit(Math.max(0, baseIndex));
        setDraft((current) => ({ ...current, units: unitDraftsFromDetails(details) }));
        setPriceHistory(details.priceHistory ?? []);
      }
    } catch {
      /* Keep the editable item fields available if details cannot be loaded. */
    }
    setModal(true);
    setError("");
  }

  function addUnit(direction: "above" | "below") {
    setDraft((current) => {
      const index = direction === "above" ? selectedUnit : selectedUnit + 1;
      const next = [...current.units];
      next.splice(index, 0, {
        unitSettingId: "",
        conversionToBase: "0.001",
        relationAmount: "1000",
        isBase: false,
      });
      setSelectedUnit(direction === "above" ? selectedUnit + 1 : selectedUnit);
      return { ...current, units: next };
    });
  }
  function deleteSelectedUnit() {
    if (draft.units.length <= 1) return
    if (draft.units[selectedUnit]?.isBase) { setError(ar ? "لا يمكن حذف الوحدة الأساسية. عيّن وحدة أخرى كأساسية أولاً." : "The base unit cannot be deleted. Choose another base unit first."); return }
    setDraft(current => ({ ...current, units: current.units.filter((_, index) => index !== selectedUnit) }))
    setSelectedUnit(index => Math.max(0, Math.min(index, draft.units.length - 2)))
  }
  function updateUnit(index: number, changes: Partial<UnitDraft>) {
    setDraft((current) => ({
      ...current,
      units: current.units.map((unit, unitIndex) =>
        unitIndex === index
          ? { ...unit, ...changes }
          : changes.isBase
            ? { ...unit, isBase: false }
            : unit,
      ),
    }));
  }
  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload = toItemPayload(draft);
      const response = await fetch(
        editing ? `/api/items/${editing.itemId}` : "/api/items",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) throw new Error(await response.text());
      setModal(false);
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : ar
            ? "تعذر حفظ الصنف."
            : "Could not save item.",
      );
    } finally {
      setSaving(false);
    }
  }

  function chooseImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(ar ? "اختر صورة صالحة." : "Choose a valid image.");
      return;
    }
    if (file.size > 1500000) {
      setError(
        ar
          ? "يجب أن يكون حجم الصورة أقل من 1.5 ميجابايت."
          : "The image must be smaller than 1.5 MB.",
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setDraft((current) => ({
        ...current,
        imageBase64: String(reader.result),
      }));
    reader.readAsDataURL(file);
  }

  async function reload() {
    const response = await fetch(
      `/api/items${showInactive ? "?includeInactive=true" : ""}`,
    );
    if (response.ok) setRows((await response.json()) as Item[]);
  }

  const columns = itemColumns(ar, primarySymbol);
  const unitName = (settingId: string) => {
    const unit = units.find((option) => String(option.settingId) === settingId);
    return unit ? (ar ? unit.valueAr : unit.valueEn) : ar ? "الوحدة" : "unit";
  };
  const baseUnitName = () => {
    const base = draft.units.find((unit) => unit.isBase);
    return base
      ? unitName(base.unitSettingId)
      : ar
        ? "الوحدة الأساسية"
        : "base unit";
  };

  return (
    <div className="settings-page" dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        title={ar ? "الأصناف" : "Items"}
        description={
          ar
            ? "إدارة الأصناف والوحدات المرتبطة بها."
            : "Manage items and their related units."
        }
        actions={
          <Button variant="primary" onClick={() => open()}>
            ＋ {ar ? "إضافة صنف" : "Add Item"}
          </Button>
        }
      />
      {error && (
        <ErrorState
          title={ar ? "تعذر تحميل الأصناف" : "Could not load items"}
          detail={error}
        />
      )}
      {loading ? (
        <LoadingState />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.itemId}
          dir={ar ? "rtl" : "ltr"}
          searchPlaceholder={
            ar ? "ابحث بالرمز أو الاسم" : "Search code or name"
          }
          searchLabel={ar ? "بحث في الأصناف" : "Search items"}
          toolbarEnd={
            <SwitchInput
              label={ar ? "عرض غير النشط" : "Show inactive"}
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
            />
          }
          rowActions={(row) => (
            <Button
              variant="icon"
              aria-label={ar ? "تعديل" : "Edit"}
              title={ar ? "تعديل" : "Edit"}
              onClick={() => open(row)}
            >
              <Icon name="edit" size={18} />
            </Button>
          )}
          pageSize={10}
          labels={
            ar
              ? {
                  rows: "أصناف",
                  actions: "الإجراءات",
                  selectVisibleRows: "تحديد الأصناف الظاهرة",
                  selectRow: (id) => `تحديد ${id}`,
                  previous: "السابق",
                  next: "التالي",
                  showing: "عرض",
                  of: "من",
                }
              : undefined
          }
          emptyTitle={ar ? "لا توجد أصناف" : "No items yet"}
          emptyDetail={
            ar
              ? "لا توجد بيانات أصناف متاحة."
              : "No migrated item data is available."
          }
        />
      )}
      <Modal
        open={modal}
        title={
          editing
            ? ar
              ? "تعديل صنف"
              : "Edit Item"
            : ar
              ? "إضافة صنف"
              : "Add Item"
        }
        titleIcon="items"
        closeLabel={ar ? "إغلاق" : "Close"}
        onClose={() => !saving && setModal(false)}
        busy={saving}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => setModal(false)}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="primary"
              loading={saving}
              onClick={() => void save()}
            >
              {ar ? "حفظ" : "Save"}
            </Button>
          </>
        }
      >
        <ItemEditorTabs ar={ar} editorTab={editorTab} setEditorTab={setEditorTab} />
        <div className="item-form-layout">
          <ItemInfoPanel
            ar={ar}
            hidden={editorTab !== "info"}
            draft={draft}
            setDraft={setDraft}
            editing={editing}
            categories={categories}
            generics={generics}
            primarySymbol={primarySymbol}
            baseUnitName={baseUnitName}
            chooseImage={chooseImage}
          />
          <ItemUnitsPanel
            ar={ar}
            hidden={editorTab !== "units"}
            draft={draft}
            units={units}
            selectedUnit={selectedUnit}
            setSelectedUnit={setSelectedUnit}
            unitName={unitName}
            baseUnitName={baseUnitName}
            addUnit={addUnit}
            deleteSelectedUnit={deleteSelectedUnit}
            updateUnit={updateUnit}
          />
          <ItemPriceHistoryPanel
            locale={locale}
            hidden={editorTab !== "pricing"}
            isNew={!editing}
            priceHistory={priceHistory}
            primarySymbol={primarySymbol}
          />
        </div>
      </Modal>
    </div>
  );
}
