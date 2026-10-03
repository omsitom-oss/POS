# Forms and dialogs

Use shared FormField, TextInput, NumberInput, CurrencyInput, DateInput, SearchInput, Select, CheckInput, Button, Modal, and ConfirmDialog. Labels, focus, errors, disabled state, required markers, and spacing belong to the shared system.

Simple add/edit workflows use centered modal dialogs with focus handling, Escape/close support, visible validation, and disabled repeat submission while saving. For hierarchical setting creation, parent comes from the current drill-down context. When editing, parent options exclude the record and its descendants; backend validation remains authoritative.

System-generated identifiers/order may be shown as read-only metadata only when useful. Never accept them as editable inputs. Show destructive or deactivation consequences in a confirmation dialog.
