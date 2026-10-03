# Light and Dark themes

Elite POS has exactly two appearance modes: Light and Dark. A single header button switches directly between them. The button shows a moon in Light mode and a sun in Dark mode. There is no menu and no System mode.

The selected value is stored as `elite-pos-theme` in local storage and restored at startup. If no value is stored, the app starts in Light mode. The root `data-theme` selects semantic CSS variables in `system.css`; components must not add isolated theme palettes. Dark surfaces use navy/charcoal tones rather than pure black. Native controls follow the selected `color-scheme`.

Use neutral monochrome icons whose color follows the active theme. Status colors are reserved for meaning and should not be used to color setting-type icons.
