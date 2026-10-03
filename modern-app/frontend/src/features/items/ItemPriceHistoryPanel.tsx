import { TableFooter } from "../../components/shared";
import { usePagination } from "../../components/usePagination";
import type { Locale } from "../../layouts/AppLayout";
import type { ItemPriceHistory } from "./itemModel";

type Props = {
  locale: Locale;
  hidden: boolean;
  isNew: boolean;
  priceHistory: ItemPriceHistory[];
  primarySymbol: string;
};

export function ItemPriceHistoryPanel({ locale, hidden, isNew, priceHistory, primarySymbol }: Props) {
  const ar = locale === "ar";
  const { rows, pager } = usePagination(priceHistory);
  return (
    <section
      className="item-pricing-panel"
      id="item-pricing-panel"
      role="tabpanel"
      aria-labelledby="item-pricing-tab"
      hidden={hidden}
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
            {!isNew
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
                {rows.map((entry) => (
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
            <TableFooter total={priceHistory.length} locale={locale} pager={pager} />
          </>
        )}
      </div>
    </section>
  );
}
