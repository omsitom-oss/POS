import { Button, ErrorState, FormField, IconButton, Select, TextInput } from "../../components/shared";
import { Icon } from "../../components/icons";
import { PageHeader } from "../../layouts/AppLayout";
import type { Item, Supplier } from "./purchaseModel";
import { PurchaseItemModal } from "./PurchaseItemModal";
import type { PurchaseEditorState } from "./usePurchaseEditor";
import { formatMoney } from "../../app/formatters";

type Props = {
  ar: boolean;
  editor: PurchaseEditorState;
  suppliers: Supplier[];
  items: Item[];
  currencySymbol: string;
  error: string;
  onCancel: () => void;
};

/** New purchase invoice: supplier, date, lines, discount and the draft/final save actions. */
export function PurchaseEditor({ ar, editor, suppliers, items, currencySymbol, error, onCancel }: Props) {
  const {
    saving, supplierId, setSupplierId, date, setDate, discount, setDiscount, notes, setNotes, lines, setLines, units,
    supplierSearch, setSupplierSearch, supplierPickerOpen, setSupplierPickerOpen, subtotal, grandTotal,
    update, choose, openItemModal, openEditItemModal, save,
  } = editor;
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
          <Button variant="ghost" onClick={onCancel}>
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
                    {formatMoney(
                      (Number(line.quantity) || 0) *
                      (Number(line.unitPrice) || 0),
                    )}
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
              {formatMoney(subtotal)}
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
              {formatMoney(grandTotal)}{" "}
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
      <PurchaseItemModal ar={ar} editor={editor} items={items} currencySymbol={currencySymbol} />
    </div>
  );
}
