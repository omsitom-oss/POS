import type { TableColumn } from "../../components/DataTable";
import { StatusBadge } from "../../components/shared";
import type { Item } from "./itemModel";

export function itemColumns(ar: boolean, primarySymbol: string): TableColumn<Item>[] {
  return [
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
}
