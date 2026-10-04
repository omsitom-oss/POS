import { Button, FormField, Modal, Select, TextInput } from "../../components/shared";
import { Icon } from "../../components/icons";
import { formatAmount, type Item } from "./purchaseModel";
import type { PurchaseEditorState } from "./usePurchaseEditor";
import { formatMoney } from "../../app/formatters";

/** Dialog that adds a line to the purchase invoice, or edits an existing one. */
export function PurchaseItemModal({ ar, editor, items, currencySymbol }: { ar: boolean; editor: PurchaseEditorState; items: Item[]; currencySymbol: string }) {
  const {
    itemModal, setItemModal, editingLineIndex, setEditingLineIndex, itemSearch, setItemSearch, itemPickerOpen, setItemPickerOpen,
    unitPriceFocused, setUnitPriceFocused, itemDraft, setItemDraft, units, chooseDraftItem, chooseDraftUnit, addDraftItem,
  } = editor;
  return (
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
              value={formatMoney(
                (Number(itemDraft.quantity) || 0) *
                (Number(itemDraft.unitPrice) || 0),
              )}
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
  );
}
