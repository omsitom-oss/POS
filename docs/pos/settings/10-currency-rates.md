# Currency exchange-rate history

`CurrencyRateHistory` stores append-only exchange-rate entries for non-primary currencies. A rate is expressed as the amount of the active primary currency equal to one unit of the selected currency. For example, when SDG is primary, a USD rate of `600` means `1 USD = 600 SDG`.

Each entry records the target `CurrencyId`, the `BaseCurrencyId` that was primary when the rate was entered, the positive decimal `Rate`, and UTC `RecordedAt`. Updating a rate inserts a new history row; it never overwrites an earlier rate. Currency list responses return only the latest entry for the current primary currency. The administration table also provides a per-currency history action backed by `GET /api/currencies/{currencyId}/rates/history`; optional `from` and `to` query parameters use `YYYY-MM-DD` and include the entire end date. Results are returned newest first. The primary currency itself is displayed as rate `1` and cannot receive a separate rate.

Migration `006_AddCurrencyRateHistory.sql` creates the table, foreign keys, positive-rate and different-currency checks, and an index for latest-rate lookup. The API writes rates through `PUT /api/currencies/{currencyId}/rate` and the currency administration screen exposes only the latest rate.
