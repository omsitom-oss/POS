# Tables and cards

Use the shared DataTable for flat, searchable datasets. It provides sorting, filtering, row selection, keyboard navigation, row actions, loading/empty states, pagination, comfortable/compact density, and RTL/LTR direction. Tables must inherit semantic Light/Dark tokens.

Use the shared Card primitive for compact selectors and card-based hierarchy navigation. Setting Type home cards are small and responsive; hierarchical settings show only direct children at the current level. Do not build or use a tree UI for Settings.

`DataTable` supports a shared toolbar end slot for compact filters beside the search field. In RTL, the toolbar follows the table direction, so search and filters mirror naturally. Use icon-only row actions with accessible labels and hover/focus tooltips when the standard icon communicates the action.

Settings administration is a bilingual master-data exception: its table displays separate Arabic and English value columns so operators can check both translations. Normal POS business screens display only the current application language. Arabic and English cells set their own text direction; codes remain LTR.
