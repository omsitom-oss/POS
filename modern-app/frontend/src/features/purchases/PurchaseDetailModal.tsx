import { Button, LoadingState, Modal, StatusBadge } from "../../components/shared";
import { formatPurchaseDate } from "./purchaseModel";
import { printPurchase } from "./printPurchase";
import type { PurchaseDetailState } from "./usePurchaseDetail";

export function PurchaseDetailModal({ ar, state }: { ar: boolean; state: PurchaseDetailState }) {
  const { detail, setDetail, detailLoading, detailSaving, detailEdits, setDetailEdits, saveDetailMetadata } = state;
  return (
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
  );
}
