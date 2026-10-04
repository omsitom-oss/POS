import { Button, FormField, NumberInput, Select } from "../../components/shared";
import { Icon } from "../../components/icons";
import type { Draft, Setting, UnitDraft } from "./itemModel";

type Props = {
  ar: boolean;
  hidden: boolean;
  draft: Draft;
  units: Setting[];
  selectedUnit: number;
  setSelectedUnit: (index: number) => void;
  unitName: (settingId: string) => string;
  baseUnitName: () => string;
  addUnit: (direction: "above" | "below") => void;
  deleteSelectedUnit: () => void;
  updateUnit: (index: number, changes: Partial<UnitDraft>) => void;
};

/** Unit hierarchy editor: parent/child units around the base unit and their conversion relations. */
export function ItemUnitsPanel({ ar, hidden, draft, units, selectedUnit, setSelectedUnit, unitName, baseUnitName, addUnit, deleteSelectedUnit, updateUnit }: Props) {
  return (
    <section
      className="item-units-panel"
      id="item-units-panel"
      role="tabpanel"
      aria-labelledby="item-units-tab"
      hidden={hidden}
    >
      <div className="item-panel-heading item-units-heading">
        <div><h3>{ar ? "الوحدات المرتبطة" : "Related units"}</h3><p>{ar ? "أدر تسلسل الوحدات والعلاقات بينها." : "Manage the unit hierarchy and conversion relationships."}</p></div>
      </div>
      <div className="unit-tree-editor">
        <div className="unit-tree">
          <div className="unit-tree-actions"><Button variant="secondary" size="small" onClick={() => addUnit("above")}>↑ {ar ? "إضافة وحدة أعلى" : "Add parent"}</Button><Button variant="secondary" size="small" onClick={() => addUnit("below")}>↓ {ar ? "إضافة وحدة أسفل" : "Add child"}</Button></div>
          {draft.units.map((unit, index) => <div key={`${index}-${unit.unitSettingId}`} className={`unit-tree-node${selectedUnit === index ? " is-selected" : ""}`}>
            {index > 0 && <div className="unit-tree-connector" />}
            <button type="button" className="unit-tree-card" onClick={() => setSelectedUnit(index)}><span className="unit-tree-order">{index + 1}</span><span className="unit-tree-icon"><Icon name="items" size={22} /></span><span className="unit-tree-copy"><strong>{unitName(unit.unitSettingId)}</strong>{unit.isBase ? <em>{ar ? "الوحدة الأساسية" : "Base unit"}</em> : <small>{index < draft.units.findIndex(x => x.isBase) ? `1 ${unitName(unit.unitSettingId)} = ${unit.relationAmount} ${baseUnitName()}` : `1 ${baseUnitName()} = ${unit.relationAmount} ${unitName(unit.unitSettingId)}`}</small>}</span>{unit.isBase && <span className="unit-tree-badge">{ar ? "أساسية" : "Base"}</span>}</button>
          </div>)}
        </div>
        <div className="unit-tree-details"><div className="item-panel-heading"><h3>{ar ? "تعديل الوحدة" : "Edit unit"}</h3><p>{ar ? "عدّل بيانات الوحدة المحددة في الشجرة." : "Edit the selected unit."}</p></div><FormField label={ar ? "اسم الوحدة" : "Unit name"} required><Select value={draft.units[selectedUnit]?.unitSettingId ?? ""} onChange={event => updateUnit(selectedUnit, { unitSettingId: event.target.value })}><option value="">{ar ? "اختر الوحدة" : "Select unit"}</option>{units.map(option => <option key={option.settingId} value={option.settingId}>{ar ? option.valueAr : option.valueEn}</option>)}</Select></FormField>{draft.units[selectedUnit] && !draft.units[selectedUnit].isBase && <FormField label={selectedUnit < draft.units.findIndex(x => x.isBase) ? (ar ? `العلاقة مع الوحدة الأساسية (${baseUnitName()})` : `Relation to base (${baseUnitName()})`) : (ar ? `العلاقة مع الوحدة الأصغر` : "Relation to child unit")}><div className="unit-relation-editor"><span>{selectedUnit < draft.units.findIndex(x => x.isBase) ? `1 ${unitName(draft.units[selectedUnit].unitSettingId)} =` : `1 ${baseUnitName()} =`}</span><NumberInput min="0.000001" step="any" value={draft.units[selectedUnit].relationAmount} onChange={event => updateUnit(selectedUnit, { relationAmount: event.target.value })} /><span>{selectedUnit < draft.units.findIndex(x => x.isBase) ? baseUnitName() : unitName(draft.units[selectedUnit].unitSettingId)}</span></div></FormField>}<div className="unit-tree-note">ⓘ {ar ? "سيتم تحويل الكميات تلقائياً عند الشراء والبيع والمخزون." : "Quantities are converted automatically in purchases, sales, and stock."}</div><Button variant="danger" size="small" onClick={deleteSelectedUnit} disabled={draft.units.length <= 1}>{ar ? "حذف الوحدة المحددة" : "Delete selected unit"}</Button></div>
      </div>
    </section>
  );
}
