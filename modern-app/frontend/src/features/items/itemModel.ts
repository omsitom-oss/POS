export type Item = {
  itemId: number;
  itemCode: string;
  nameAr: string;
  nameEn: string;
  manufacturerName: string | null;
  imageBase64: string | null;
  categorySettingId: number | null;
  genericSettingId: number | null;
  categoryAr: string | null;
  categoryEn: string | null;
  baseUnitAr: string | null;
  baseUnitEn: string | null;
  sellPrice: number;
  lastPurchasePrice: number | null;
  minimumLevelForAlert: number;
  isActive: boolean;
};
export type ItemPriceHistory = {
  itemPriceHistoryId: number;
  previousPrice: number | null;
  newPrice: number;
  userId: number | null;
  userName: string | null;
  changedAt: string;
};
export type ItemDetails = {
  item: Item;
  units: Array<{
    unitSettingId: number;
    conversionToBase: number;
    isBase: boolean;
    sortOrder: number;
  }>;
  priceHistory: ItemPriceHistory[];
};
export type Setting = { settingId: number; valueAr: string; valueEn: string };
export type UnitDraft = {
  unitSettingId: string;
  conversionToBase: string;
  relationAmount: string;
  isBase: boolean;
};
export type Draft = {
  nameAr: string;
  nameEn: string;
  manufacturerName: string;
  imageBase64: string | null;
  categorySettingId: string;
  genericSettingId: string;
  sellPrice: string;
  minimumLevelForAlert: string;
  isActive: boolean;
  units: UnitDraft[];
};
export const blankDraft: Draft = {
  nameAr: "",
  nameEn: "",
  manufacturerName: "",
  imageBase64: null,
  categorySettingId: "",
  genericSettingId: "",
  sellPrice: "0",
  minimumLevelForAlert: "0",
  isActive: true,
  units: [
    {
      unitSettingId: "",
      conversionToBase: "1",
      relationAmount: "1",
      isBase: true,
    },
  ],
};

/** Converts the editor draft to the API write model; non-base unit relations become conversion factors. */
export function toItemPayload(draft: Draft) {
  const baseIndex = draft.units.findIndex((unit) => unit.isBase);
  return {
    ...draft,
    categorySettingId: draft.categorySettingId
      ? Number(draft.categorySettingId)
      : null,
    genericSettingId: draft.genericSettingId
      ? Number(draft.genericSettingId)
      : null,
    sellPrice: Number(draft.sellPrice),
    minimumLevelForAlert: Number(draft.minimumLevelForAlert),
    units: draft.units.map((unit, index) => ({
      unitSettingId: Number(unit.unitSettingId),
      conversionToBase: unit.isBase
        ? 1
        : index < baseIndex
          ? Number(unit.relationAmount)
          : 1 / Number(unit.relationAmount),
      isBase: unit.isBase,
      sortOrder: index,
    })),
  };
}

export function draftFromItem(item: Item): Draft {
  return {
    ...blankDraft,
    nameAr: item.nameAr,
    nameEn: item.nameEn,
    manufacturerName: item.manufacturerName ?? "",
    imageBase64: item.imageBase64,
    categorySettingId: item.categorySettingId
      ? String(item.categorySettingId)
      : "",
    genericSettingId: item.genericSettingId
      ? String(item.genericSettingId)
      : "",
    sellPrice: String(item.sellPrice),
    minimumLevelForAlert: String(item.minimumLevelForAlert),
    isActive: item.isActive,
  };
}

/** Editor rows for an item's stored units; relationAmount is shown as a whole number in either direction. */
export function unitDraftsFromDetails(details: ItemDetails): UnitDraft[] {
  return details.units.map((unit) => ({
    unitSettingId: String(unit.unitSettingId),
    conversionToBase: String(unit.conversionToBase),
    relationAmount: unit.isBase
      ? "1"
      : String(
          unit.conversionToBase >= 1
            ? unit.conversionToBase
            : 1 / unit.conversionToBase,
        ),
    isBase: unit.isBase,
  }));
}
