import { useState } from "react";
import type { DetailEdit, PurchaseDetail } from "./purchaseModel";

/** Loads one purchase for the read-only detail dialog and saves its per-line expiry/barcode edits. */
export function usePurchaseDetail({ ar, setError }: { ar: boolean; setError: (message: string) => void }) {
  const [detail, setDetail] = useState<PurchaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailEdits, setDetailEdits] = useState<Record<number, DetailEdit>>({});
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
  return { detail, setDetail, detailLoading, detailSaving, detailEdits, setDetailEdits, openDetail, saveDetailMetadata };
}

export type PurchaseDetailState = ReturnType<typeof usePurchaseDetail>;
