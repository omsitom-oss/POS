# Typography and spacing

Typography, spacing, control heights, radii, and shadows are tokens in `frontend/src/styles/tokens.css`. Prefer shared tokens and component rules over repeated values in feature CSS. Typical text is 15–16px, table text 14–16px, labels 14–15px, and helper text at least 13px. Page titles use `--font-title` (26px). Arabic uses generous line height.

Inputs and primary actions use `--control-height` (42px); radii are 8/12/16px (`--radius-sm/md/lg`). Tables and cards remain compact but comfortable for long daily use. Use logical inline/block spacing so dimensions and alignment work in RTL and LTR.
