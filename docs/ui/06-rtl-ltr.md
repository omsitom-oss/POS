# RTL and LTR

English is LTR; Arabic is RTL. Changing language updates the root `lang` and `dir` and rerenders localized interface labels and values. Normal screens display only the selected language, never both translations together. Bilingual inputs may appear together only while creating or editing translated master data.

Use CSS logical properties and document flow so shell, breadcrumbs, cards, forms, dialogs, tables, menus, arrows, and pagination mirror as appropriate. Directional arrows should mirror; neutral icons should not. Arabic fields remain RTL and English fields LTR regardless of surrounding language. Check both directions in Light and Dark modes.
