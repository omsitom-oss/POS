import { Icon } from "../../components/icons";

export type ItemEditorTab = "info" | "units" | "pricing";

export function ItemEditorTabs({ ar, editorTab, setEditorTab }: { ar: boolean; editorTab: ItemEditorTab; setEditorTab: (tab: ItemEditorTab) => void }) {
  return (
    <div
      className="item-editor-tabs"
      role="tablist"
      aria-label={ar ? "تبويبات الصنف" : "Item editor tabs"}
    >
      <button
        type="button"
        role="tab"
        id="item-info-tab"
        aria-controls="item-info-panel"
        aria-selected={editorTab === "info"}
        className={editorTab === "info" ? "is-active" : ""}
        onClick={() => setEditorTab("info")}
      >
        <Icon name="info" size={17} />
        {ar ? "معلومات الصنف" : "Item information"}
      </button>
      <button
        type="button"
        role="tab"
        id="item-units-tab"
        aria-controls="item-units-panel"
        aria-selected={editorTab === "units"}
        className={editorTab === "units" ? "is-active" : ""}
        onClick={() => setEditorTab("units")}
      >
        <Icon name="ruler" size={17} />
        {ar ? "الوحدات" : "Units"}
      </button>
      <button
        type="button"
        role="tab"
        id="item-pricing-tab"
        aria-controls="item-pricing-panel"
        aria-selected={editorTab === "pricing"}
        className={editorTab === "pricing" ? "is-active" : ""}
        onClick={() => setEditorTab("pricing")}
      >
        <Icon name="history" size={17} />
        {ar ? "التسعير" : "Pricing"}
      </button>
    </div>
  );
}
