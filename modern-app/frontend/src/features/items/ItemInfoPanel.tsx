import { FormField, NumberInput, Select, StatusToggle, TextInput } from "../../components/shared";
import { Icon } from "../../components/icons";
import type { Draft, Item, Setting } from "./itemModel";

type Props = {
  ar: boolean;
  hidden: boolean;
  draft: Draft;
  setDraft: (draft: Draft) => void;
  editing: Item | null;
  categories: Setting[];
  generics: Setting[];
  primarySymbol: string;
  baseUnitName: () => string;
  chooseImage: (file?: File) => void;
};

export function ItemInfoPanel({ ar, hidden, draft, setDraft, editing, categories, generics, primarySymbol, baseUnitName, chooseImage }: Props) {
  return (
    <section
      className="item-info-panel"
      id="item-info-panel"
      role="tabpanel"
      aria-labelledby="item-info-tab"
      hidden={hidden}
    >
      <div className="item-panel-heading item-info-heading">
        <div>
          <h3>{ar ? "معلومات الصنف" : "Item information"}</h3>
          <p>
            {ar
              ? "البيانات الأساسية للصنف"
              : "Basic details about the item"}
          </p>
        </div>
        <StatusToggle
          checked={draft.isActive}
          activeLabel={ar ? "نشط" : "Active"}
          inactiveLabel={ar ? "غير نشط" : "Inactive"}
          onChange={(event) =>
            setDraft({ ...draft, isActive: event.target.checked })
          }
        />
      </div>
      <div className="item-info-layout">
        <div className="item-profile-card">
          <FormField
            label={ar ? "صورة الصنف" : "Item image"}
            hint={
              ar
                ? "PNG أو JPEG أو WebP، بحد أقصى 1.5 ميجابايت."
                : "PNG, JPEG, or WebP up to 1.5 MB."
            }
          >
            <div className="item-image-box">
              {draft.imageBase64 ? (
                <img
                  src={draft.imageBase64}
                  alt={ar ? "صورة الصنف" : "Item"}
                />
              ) : (
                <div className="item-image-placeholder">
                  <Icon name="image" size={34} />
                  <span>{ar ? "لا توجد صورة" : "No image"}</span>
                </div>
              )}
              <label
                className="item-image-edit"
                title={ar ? "تغيير الصورة" : "Change image"}
                aria-label={ar ? "تغيير الصورة" : "Change image"}
              >
                <Icon name="edit" size={16} />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) =>
                    chooseImage(event.target.files?.[0])
                  }
                />
              </label>
            </div>
          </FormField>
          <strong className="item-profile-name">
            {draft.nameEn || (ar ? "صنف جديد" : "New item")}
          </strong>
          <span className="item-profile-code">
            {editing?.itemCode ??
              (ar
                ? "سيتم إنشاء الرمز عند الحفظ"
                : "Code generated on save")}
          </span>
        </div>
        <div className="settings-form item-form">
          <FormField
            label={ar ? "الاسم بالعربية" : "Arabic name"}
            required
          >
            <TextInput
              dir="rtl"
              value={draft.nameAr}
              onChange={(event) =>
                setDraft({ ...draft, nameAr: event.target.value })
              }
            />
          </FormField>
          <FormField
            label={ar ? "الاسم بالإنجليزية" : "English name"}
            required
          >
            <TextInput
              dir="ltr"
              value={draft.nameEn}
              onChange={(event) =>
                setDraft({ ...draft, nameEn: event.target.value })
              }
            />
          </FormField>
          <FormField label={ar ? "الشركة المصنعة" : "Manufacturer"}>
            <TextInput
              value={draft.manufacturerName}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  manufacturerName: event.target.value,
                })
              }
            />
          </FormField>
          <FormField label={ar ? "التصنيف" : "Category"}>
            <Select
              value={draft.categorySettingId}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  categorySettingId: event.target.value,
                })
              }
            >
              <option value="">
                {ar ? "بدون تصنيف" : "No category"}
              </option>
              {categories.map((item) => (
                <option key={item.settingId} value={item.settingId}>
                  {ar ? item.valueAr : item.valueEn}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={ar ? "الاسم العلمي" : "Generic name"}>
            <Select
              value={draft.genericSettingId}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  genericSettingId: event.target.value,
                })
              }
            >
              <option value="">
                {ar ? "بدون اسم علمي" : "No generic name"}
              </option>
              {generics.map((item) => (
                <option key={item.settingId} value={item.settingId}>
                  {ar ? item.valueAr : item.valueEn}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={ar ? "سعر البيع" : "Selling price"}>
            <div className="item-price-input">
              <NumberInput
                min="0"
                value={draft.sellPrice}
                onChange={(event) =>
                  setDraft({ ...draft, sellPrice: event.target.value })
                }
              />
              <span>{primarySymbol || "—"} / {baseUnitName()}</span>
            </div>
          </FormField>
          <FormField
            label={ar ? "حد التنبيه الأدنى" : "Minimum alert level"}
          >
            <NumberInput
              min="0"
              step="1"
              value={draft.minimumLevelForAlert}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  minimumLevelForAlert: event.target.value,
                })
              }
            />
          </FormField>
        </div>
      </div>
    </section>
  );
}
