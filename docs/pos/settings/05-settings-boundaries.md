# Settings boundaries

Good fits: unit names; item category names and subcategories; a general location tree containing country/state/city/area nodes; other small, named values with no specialized lifecycle or domain attributes.

Keep dedicated: items, customers, suppliers, warehouses, employees/users, sales/purchases, stock movements, accounts/banks, and any entity that owns transaction history, financial calculations, security, substantial relationships, or specialized behavior. Taxes, currencies, payment methods, insurance companies, manufacturers, and legacy insurance concepts require workflow-specific review before choosing a representation. Do not append specialized nullable columns to `Settings`.

Categories are generic settings only as labels; item behavior/pricing remains on future item-specific tables. Locations do not force a Country → City schema; any number of levels is possible. Localization is two columns on one row, not separate language rows.
