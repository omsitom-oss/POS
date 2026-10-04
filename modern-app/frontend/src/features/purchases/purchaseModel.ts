export type Supplier = {
  partnerId: number;
  customerCode?: string;
  businessName?: string;
  partnerName?: string;
  partnerTypeCode?: string;
};
export type Item = {
  itemId: number;
  nameAr: string;
  nameEn: string;
  sellPrice: number;
  lastPurchasePrice?: number | null;
};
export type Purchase = {
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
export type PurchaseDetail = Purchase & {
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
export type Currency = { currencyId: number; symbol: string; isPrimary: boolean; isActive: boolean };
export type Unit = {
  unitSettingId: number;
  unitAr?: string;
  unitEn?: string;
  isBase: boolean;
  conversionToBase: number;
};
export type Line = {
  itemId: string;
  unitSettingId: string;
  quantity: string;
  unitPrice: string;
  expiryDate: string;
  barcode: string;
  batchNo: string;
};
export type DetailEdit = { expiryDate: string; barcode: string };

export function formatAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString("en-US", { maximumFractionDigits: 6 })
    : value;
}
export function formatPurchaseDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export const blankLine: Line = {
  itemId: "",
  unitSettingId: "",
  quantity: "1",
  unitPrice: "0",
  expiryDate: "",
  barcode: "",
  batchNo: "",
};
