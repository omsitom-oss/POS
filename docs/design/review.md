# Design review and modern refresh

This note records what the October 2026 design review found in the React UI and what the refresh changed. Screenshots of every screen in Light/Dark × English/Arabic are in `screenshots/before` and `screenshots/after`; each image is a 2×2 grid (light-en, light-ar, dark-en, dark-ar) at 1366×768.

## What the review found

- **Three token layers fighting each other.** `system.css` defined an original `:root` palette with tiny 9–11px type, then a second semantic `:root` block, then 51 `[data-theme='dark'] .component` patches. 268 hard-coded hex colors remained, and five variables were used but never defined (`--font-caption`, `--shadow-sm`, `--surface-hover`, `--shadow-card-hover`, `--text`).
- **Sidebar bugs.** The Accounts sub-menu was clipped (Treasury transfer was cut off) because flex children of the scrolling nav were allowed to shrink. The sidebar was 278px wide on a 1366px screen.
- **Clicking your own name logged you out.** The whole user chip in the header was the logout button.
- **Cashier screen overflow.** The lines table had `min-width: 720px` inside a non-scrolling panel, so its header ran under the Sale details panel at 1366×768.
- **Text glyphs instead of icons.** `☾ ♙ ▣ ⌫ ◇ ⚙ 🛒 ×` rendered differently per font and did not follow the theme.
- **Inconsistent tables.** Sales list headers were centered while cells were start-aligned, totals were not right-aligned or formatted (`48.5 JD`), and document numbers switched to a monospace font on some pages only.
- **Login page** used decorative orbits and glows with fixed light colors that needed a separate dark patch set.

## Direction

Clean, calm workstation UI: neutral surfaces, one teal brand color, soft borders instead of heavy shadows, and generous but not oversized controls. Light mode uses a light sidebar; Dark mode uses deep navy surfaces (never pure black).

| Token group | Values |
| --- | --- |
| Font | `--font-sans`: Segoe UI → Simplified Arabic → Tahoma → system. Body 15px, table 14px, labels 14px, helper 13px, title 26px |
| Radius | 8 / 12 / 16px, pill for badges |
| Controls | 42px inputs and buttons, 34px small buttons, 54px table rows (46px compact) |
| Brand | Light `#0b7d78` on white; Dark `#34c0b4` with dark text |
| Elevation | `--shadow-xs` → `--shadow-dialog`, five steps |

All tokens live in `modern-app/frontend/src/styles/tokens.css`. Dark mode only redefines token values; components contain no theme-specific rules.

## What changed

- `tokens.css` is the single token source; `system.css` foundation was rewritten on those tokens and lost the legacy layer and all dark patches (1,621 → about 1,200 lines). Page-specific rules kept their layout and now inherit the new tokens.
- Shell: lighter 252px sidebar with pill-style active items, sticky translucent top bar, separate logout button, icon sidebar toggle.
- Buttons, inputs, tabs (segmented control), badges (with status dot), tables, dialogs (no accent bar, softer header), empty/loading/error states and toasts restyled.
- Sales list uses status badges and aligned, formatted totals; cashier lines table fits its panel.
- New icons: `menu`, `trash`, `user`, `lock`, `save`, `close`, `arrow-left`. Directional icons use `icon-flip-rtl`.

## Known gaps (not design, left for their owners)

- `CurrencyInput` hard-codes the `د.إ` prefix, and inventory always shows `SDG` while purchases and treasuries fall back to it when no primary currency is set.
- Several pages still build tables by hand instead of `DataTable`; moving them is part of the per-page refresh (WS3-T3).
