import { useEffect, useState } from "react";
import { DataTable, type TableColumn } from "../../components/DataTable";
import {
  Button,
  TableFooter,
  ErrorState,
  FormField,
  LoadingState,
  Modal,
  NumberInput,
  Select,
  StatusBadge,
  StatusToggle,
  SwitchInput,
  TextInput,
} from "../../components/shared";
import { Icon } from "../../components/icons";
import { PageHeader, type Locale } from "../../layouts/AppLayout";

type Item = {
  itemId: number;
  itemCode: string;
  nameAr: string;
  nameEn: string;
  manufacturerName: string | null;
  imageBase64: string | null;
  categorySettingId: number | null;
  genericSettingId: number | null;
  categoryAr: string | null;
  categoryEn: string | null;
  baseUnitAr: string | null;
  baseUnitEn: string | null;
  sellPrice: number;
  lastPurchasePrice: number | null;
  minimumLevelForAlert: number;
  isActive: boolean;
};
type ItemPriceHistory = {
  itemPriceHistoryId: number;
  previousPrice: number | null;
  newPrice: number;
  userId: number | null;
  userName: string | null;
  changedAt: string;
};
type ItemDetails = {
  item: Item;
  units: Array<{
    unitSettingId: number;
    conversionToBase: number;
    isBase: boolean;
    sortOrder: number;
  }>;
  priceHistory: ItemPriceHistory[];
};
type Setting = { settingId: number; valueAr: string; valueEn: string };
type UnitDraft = {
  unitSettingId: string;
  conversionToBase: string;
  relationAmount: string;
  isBase: boolean;
};
type Draft = {
  nameAr: string;
  nameEn: string;
  manufacturerName: string;
  imageBase64: string | null;
  categorySettingId: string;
  genericSettingId: string;
  sellPrice: string;
  minimumLevelForAlert: string;
  isActive: boolean;
  units: UnitDraft[];
};
const blankDraft: Draft = {
  nameAr: "",
  nameEn: "",
  manufacturerName: "",
  imageBase64: null,
  categorySettingId: "",
  genericSettingId: "",
  sellPrice: "0",
  minimumLevelForAlert: "0",
  isActive: true,
  units: [
    {
      unitSettingId: "",
      conversionToBase: "1",
      relationAmount: "1",
      isBase: true,
    },
  ],
};

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
  const [editorTab, setEditorTab] = useState<"info" | "units" | "pricing">(
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
    setDraft({
      ...blankDraft,
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      manufacturerName: item.manufacturerName ?? "",
      imageBase64: item.imageBase64,
      categorySettingId: item.categorySettingId
        ? String(item.categorySettingId)
        : "",
      genericSettingId: item.genericSettingId
        ? String(item.genericSettingId)
        : "",
      sellPrice: String(item.sellPrice),
      minimumLevelForAlert: String(item.minimumLevelForAlert),
      isActive: item.isActive,
    });
    try {
      const response = await fetch(`/api/items/${item.itemId}`);
      if (response.ok) {
        const details = (await response.json()) as ItemDetails;
        const baseIndex = details.units.findIndex((unit) => unit.isBase);
        setSelectedUnit(Math.max(0, baseIndex));
        setDraft((current) => ({
          ...current,
          units: details.units.map((unit) => ({
            unitSettingId: String(unit.unitSettingId),
            conversionToBase: String(unit.conversionToBase),
            relationAmount: unit.isBase
              ? "1"
              : String(
                  unit.conversionToBase >= 1
                    ? unit.conversionToBase
                    : 1 / unit.conversionToBase,
                ),
            isBase: unit.isBase,
          })),
        }));
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
      const baseIndex = draft.units.findIndex((unit) => unit.isBase);
      const payload = {
        ...draft,
        categorySettingId: draft.categorySettingId
          ? Number(draft.categorySettingId)
          : null,
        genericSettingId: draft.genericSettingId
          ? Number(draft.genericSettingId)
          : null,
        sellPrice: Number(draft.sellPrice),
        minimumLevelForAlert: Number(draft.minimumLevelForAlert),
        units: draft.units.map((unit, index) => ({
          unitSettingId: Number(unit.unitSettingId),
          conversionToBase: unit.isBase
            ? 1
            : index < baseIndex
              ? Number(unit.relationAmount)
              : 1 / Number(unit.relationAmount),
          isBase: unit.isBase,
          sortOrder: index,
        })),
      };
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

  const columns: TableColumn<Item>[] = [
    {
      key: "code",
      title: ar ? "الرمز" : "Code",
      value: (row) => row.itemCode,
      render: (row) => <span dir="ltr">{row.itemCode}</span>,
      sortable: true,
    },
    {
      key: "nameAr",
      title: ar ? "الاسم العربي" : "Arabic Name",
      value: (row) => row.nameAr,
      render: (row) => <span dir="rtl">{row.nameAr}</span>,
      sortable: true,
    },
    {
      key: "nameEn",
      title: ar ? "الاسم الإنجليزي" : "English Name",
      value: (row) => row.nameEn,
      render: (row) => <span dir="ltr">{row.nameEn}</span>,
      sortable: true,
    },
    {
      key: "category",
      title: ar ? "التصنيف" : "Category",
      value: (row) => row.categoryEn ?? "",
      render: (row) => (ar ? (row.categoryAr ?? "—") : (row.categoryEn ?? "—")),
      sortable: true,
    },
    {
      key: "unit",
      title: ar ? "الوحدة الأساسية" : "Base Unit",
      value: (row) => row.baseUnitEn ?? "",
      render: (row) => (ar ? (row.baseUnitAr ?? "—") : (row.baseUnitEn ?? "—")),
      sortable: true,
    },
    {
      key: "price",
      title: ar ? "السعر" : "Price",
      value: (row) => row.sellPrice,
      render: (row) => (
        <span dir="ltr">
          {row.sellPrice.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
      sortable: true,
    },
    {
      key: "lastPurchasePrice",
      title: ar ? "آخر سعر شراء" : "Last purchase price",
      value: (row) => row.lastPurchasePrice ?? 0,
      render: (row) => <span dir="ltr">{row.lastPurchasePrice == null ? "—" : `${row.lastPurchasePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${primarySymbol}`}</span>,
      sortable: true,
    },
    {
      key: "status",
      title: ar ? "الحالة" : "Status",
      value: (row) => (row.isActive ? "Active" : "Inactive"),
      render: (row) => (
        <StatusBadge tone={row.isActive ? "success" : "danger"}>
          {row.isActive ? (ar ? "نشط" : "Active") : ar ? "غير نشط" : "Inactive"}
        </StatusBadge>
      ),
      sortable: false,
    },
  ];
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
        <div
          className="item-editor-tabs"
          role="tablist"
          aria-label={ar ? "تبويبات الصنف" : "Item editor tabs"}
        >
          <button
            type="button"
            role="tab"
            id="item-info-tab"
            aria-controls="item-info-panel"
            aria-selected={editorTab === "info"}
            className={editorTab === "info" ? "is-active" : ""}
            onClick={() => setEditorTab("info")}
          >
            <Icon name="info" size={17} />
            {ar ? "معلومات الصنف" : "Item information"}
          </button>
          <button
            type="button"
            role="tab"
            id="item-units-tab"
            aria-controls="item-units-panel"
            aria-selected={editorTab === "units"}
            className={editorTab === "units" ? "is-active" : ""}
            onClick={() => setEditorTab("units")}
          >
            <Icon name="ruler" size={17} />
            {ar ? "الوحدات" : "Units"}
          </button>
          <button
            type="button"
            role="tab"
            id="item-pricing-tab"
            aria-controls="item-pricing-panel"
            aria-selected={editorTab === "pricing"}
            className={editorTab === "pricing" ? "is-active" : ""}
            onClick={() => setEditorTab("pricing")}
          >
            <Icon name="history" size={17} />
            {ar ? "التسعير" : "Pricing"}
          </button>
        </div>
        <div className="item-form-layout">
          <section
            className="item-info-panel"
            id="item-info-panel"
            role="tabpanel"
            aria-labelledby="item-info-tab"
            hidden={editorTab !== "info"}
          >
            <div className="item-panel-heading item-info-heading">
              <div>
                <h3>{ar ? "معلومات الصنف" : "Item information"}</h3>
                <p>
                  {ar
                    ? "البيانات الأساسية للصنف"
                    : "Basic details about the item"}
                </p>
              </div>
              <StatusToggle
                checked={draft.isActive}
                activeLabel={ar ? "نشط" : "Active"}
                inactiveLabel={ar ? "غير نشط" : "Inactive"}
                onChange={(event) =>
                  setDraft({ ...draft, isActive: event.target.checked })
                }
              />
            </div>
            <div className="item-info-layout">
              <div className="item-profile-card">
                <FormField
                  label={ar ? "صورة الصنف" : "Item image"}
                  hint={
                    ar
                      ? "PNG أو JPEG أو WebP، بحد أقصى 1.5 ميجابايت."
                      : "PNG, JPEG, or WebP up to 1.5 MB."
                  }
                >
                  <div className="item-image-box">
                    {draft.imageBase64 ? (
                      <img
                        src={draft.imageBase64}
                        alt={ar ? "صورة الصنف" : "Item"}
                      />
                    ) : (
                      <div className="item-image-placeholder">
                        <Icon name="image" size={34} />
                        <span>{ar ? "لا توجد صورة" : "No image"}</span>
                      </div>
                    )}
                    <label
                      className="item-image-edit"
                      title={ar ? "تغيير الصورة" : "Change image"}
                      aria-label={ar ? "تغيير الصورة" : "Change image"}
                    >
                      <Icon name="edit" size={16} />
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) =>
                          chooseImage(event.target.files?.[0])
                        }
                      />
                    </label>
                  </div>
                </FormField>
                <strong className="item-profile-name">
                  {draft.nameEn || (ar ? "صنف جديد" : "New item")}
                </strong>
                <span className="item-profile-code">
                  {editing?.itemCode ??
                    (ar
                      ? "سيتم إنشاء الرمز عند الحفظ"
                      : "Code generated on save")}
                </span>
              </div>
              <div className="settings-form item-form">
                <FormField
                  label={ar ? "الاسم بالعربية" : "Arabic name"}
                  required
                >
                  <TextInput
                    dir="rtl"
                    value={draft.nameAr}
                    onChange={(event) =>
                      setDraft({ ...draft, nameAr: event.target.value })
                    }
                  />
                </FormField>
                <FormField
                  label={ar ? "الاسم بالإنجليزية" : "English name"}
                  required
                >
                  <TextInput
                    dir="ltr"
                    value={draft.nameEn}
                    onChange={(event) =>
                      setDraft({ ...draft, nameEn: event.target.value })
                    }
                  />
                </FormField>
                <FormField label={ar ? "الشركة المصنعة" : "Manufacturer"}>
                  <TextInput
                    value={draft.manufacturerName}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        manufacturerName: event.target.value,
                      })
                    }
                  />
                </FormField>
                <FormField label={ar ? "التصنيف" : "Category"}>
                  <Select
                    value={draft.categorySettingId}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        categorySettingId: event.target.value,
                      })
                    }
                  >
                    <option value="">
                      {ar ? "بدون تصنيف" : "No category"}
                    </option>
                    {categories.map((item) => (
                      <option key={item.settingId} value={item.settingId}>
                        {ar ? item.valueAr : item.valueEn}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label={ar ? "الاسم العلمي" : "Generic name"}>
                  <Select
                    value={draft.genericSettingId}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        genericSettingId: event.target.value,
                      })
                    }
                  >
                    <option value="">
                      {ar ? "بدون اسم علمي" : "No generic name"}
                    </option>
                    {generics.map((item) => (
                      <option key={item.settingId} value={item.settingId}>
                        {ar ? item.valueAr : item.valueEn}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label={ar ? "سعر البيع" : "Selling price"}>
                  <div className="item-price-input">
                    <NumberInput
                      min="0"
                      value={draft.sellPrice}
                      onChange={(event) =>
                        setDraft({ ...draft, sellPrice: event.target.value })
                      }
                    />
                    <span>{primarySymbol || "—"} / {baseUnitName()}</span>
                  </div>
                </FormField>
                <FormField
                  label={ar ? "حد التنبيه الأدنى" : "Minimum alert level"}
                >
                  <NumberInput
                    min="0"
                    step="1"
                    value={draft.minimumLevelForAlert}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        minimumLevelForAlert: event.target.value,
                      })
                    }
                  />
                </FormField>
              </div>
            </div>
          </section>
          <section
            className="item-units-panel"
            id="item-units-panel"
            role="tabpanel"
            aria-labelledby="item-units-tab"
            hidden={editorTab !== "units"}
          >
            <div className="item-panel-heading item-units-heading">
              <div><h3>{ar ? "الوحدات المرتبطة" : "Related units"}</h3><p>{ar ? "أدر تسلسل الوحدات والعلاقات بينها." : "Manage the unit hierarchy and conversion relationships."}</p></div>
            </div>
            <div className="unit-tree-editor">
              <div className="unit-tree">
                <div className="unit-tree-actions"><Button variant="secondary" size="small" onClick={() => addUnit("above")}>↑ {ar ? "إضافة وحدة أعلى" : "Add parent"}</Button><Button variant="secondary" size="small" onClick={() => addUnit("below")}>↓ {ar ? "إضافة وحدة أسفل" : "Add child"}</Button></div>
                {draft.units.map((unit, index) => <div key={`${index}-${unit.unitSettingId}`} className={`unit-tree-node${selectedUnit === index ? " is-selected" : ""}`}>
                  {index > 0 && <div className="unit-tree-connector" />}
                  <button type="button" className="unit-tree-card" onClick={() => setSelectedUnit(index)}><span className="unit-tree-order">{index + 1}</span><span className="unit-tree-icon"><Icon name="items" size={22} /></span><span className="unit-tree-copy"><strong>{unitName(unit.unitSettingId)}</strong>{unit.isBase ? <em>{ar ? "الوحدة الأساسية" : "Base unit"}</em> : <small>{index < draft.units.findIndex(x => x.isBase) ? `1 ${unitName(unit.unitSettingId)} = ${unit.relationAmount} ${baseUnitName()}` : `1 ${baseUnitName()} = ${unit.relationAmount} ${unitName(unit.unitSettingId)}`}</small>}</span>{unit.isBase && <span className="unit-tree-badge">{ar ? "أساسية" : "Base"}</span>}</button>
                </div>)}
              </div>
              <div className="unit-tree-details"><div className="item-panel-heading"><h3>{ar ? "تعديل الوحدة" : "Edit unit"}</h3><p>{ar ? "عدّل بيانات الوحدة المحددة في الشجرة." : "Edit the selected unit."}</p></div><FormField label={ar ? "اسم الوحدة" : "Unit name"} required><Select value={draft.units[selectedUnit]?.unitSettingId ?? ""} onChange={event => updateUnit(selectedUnit, { unitSettingId: event.target.value })}><option value="">{ar ? "اختر الوحدة" : "Select unit"}</option>{units.map(option => <option key={option.settingId} value={option.settingId}>{ar ? option.valueAr : option.valueEn}</option>)}</Select></FormField>{draft.units[selectedUnit] && !draft.units[selectedUnit].isBase && <FormField label={selectedUnit < draft.units.findIndex(x => x.isBase) ? (ar ? `العلاقة مع الوحدة الأساسية (${baseUnitName()})` : `Relation to base (${baseUnitName()})`) : (ar ? `العلاقة مع الوحدة الأصغر` : "Relation to child unit")}><div className="unit-relation-editor"><span>{selectedUnit < draft.units.findIndex(x => x.isBase) ? `1 ${unitName(draft.units[selectedUnit].unitSettingId)} =` : `1 ${baseUnitName()} =`}</span><NumberInput min="0.000001" step="any" value={draft.units[selectedUnit].relationAmount} onChange={event => updateUnit(selectedUnit, { relationAmount: event.target.value })} /><span>{selectedUnit < draft.units.findIndex(x => x.isBase) ? baseUnitName() : unitName(draft.units[selectedUnit].unitSettingId)}</span></div></FormField>}<div className="unit-tree-note">ⓘ {ar ? "سيتم تحويل الكميات تلقائياً عند الشراء والبيع والمخزون." : "Quantities are converted automatically in purchases, sales, and stock."}</div><Button variant="danger" size="small" onClick={deleteSelectedUnit} disabled={draft.units.length <= 1}>{ar ? "حذف الوحدة المحددة" : "Delete selected unit"}</Button></div>
            </div>
          </section>
          <section
            className="item-pricing-panel"
            id="item-pricing-panel"
            role="tabpanel"
            aria-labelledby="item-pricing-tab"
            hidden={editorTab !== "pricing"}
          >
            <div className="item-panel-heading">
              <h3>{ar ? "سجل الأسعار" : "Price history"}</h3>
              <p>
                {ar
                  ? "تظهر هنا كل تغييرات سعر البيع مع المستخدم والتاريخ."
                  : "Every selling-price change is recorded with the user and date."}
              </p>
            </div>
            <div className="item-price-history-table-wrap">
              {priceHistory.length === 0 ? (
                <div className="item-price-history-empty">
                  {editing
                    ? ar
                      ? "لا توجد تغييرات مسجلة لهذا الصنف."
                      : "No price changes recorded for this item."
                    : ar
                      ? "سيظهر السجل بعد حفظ الصنف."
                      : "History will appear after the item is saved."}
                </div>
              ) : (
                <>
                  <table className="item-price-history-table">
                    <thead>
                      <tr>
                        <th>{ar ? "السعر السابق" : "Previous price"}</th>
                        <th>{ar ? "السعر الجديد" : "New price"}</th>
                        <th>{ar ? "المستخدم" : "User"}</th>
                        <th>{ar ? "التاريخ" : "Date"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceHistory.map((entry) => (
                        <tr key={entry.itemPriceHistoryId}>
                          <td>
                            {entry.previousPrice == null
                              ? "—"
                              : `${entry.previousPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${primarySymbol}`}
                          </td>
                          <td>{`${entry.newPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${primarySymbol}`}</td>
                          <td>
                            {entry.userName ??
                              (entry.userId
                                ? `#${entry.userId}`
                                : ar
                                  ? "النظام"
                                  : "System")}
                          </td>
                          <td dir="ltr">
                            {new Date(entry.changedAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <TableFooter total={priceHistory.length} locale={locale} />
                </>
              )}
            </div>
          </section>
        </div>
      </Modal>
    </div>
  );
}
