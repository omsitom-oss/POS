// Types and helpers for import shipments (/api/imports). Amounts named *Base are in the main currency.

export type AllocationMethod = 'VALUE' | 'QUANTITY'
export type PayeeType = 'PARTNER' | 'TREASURY' | 'ACCOUNT'
export type ShipmentStatus = 'DRAFT' | 'POSTED' | 'CANCELLED'

export type ImportLine = {
  purchaseLineId: number
  itemId: number
  itemName: string
  unitSettingId: number | null
  unitName: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
  goodsBase: number
  allocatedCostBase: number
  landedTotalBase: number
  landedUnitCostBase: number
  expiryDate: string | null
  batchNo: string | null
  barcode: string | null
}

export type ImportCost = {
  costId: number
  costType: string
  amount: number
  currencyId: number
  currencyCode: string
  currencySymbol: string
  exchangeRateToBase: number
  baseAmount: number
  payeeType: PayeeType
  payeePartnerId: number | null
  payeeTreasuryId: number | null
  payeeAccountCode: string | null
  payeeName: string
  description: string | null
}

export type ImportShipment = {
  purchaseId: number
  invoiceNo: string
  status: ShipmentStatus
  branchId: number
  supplierPartnerId: number
  supplierName: string
  purchaseDate: string
  currencyId: number
  currencyCode: string
  currencySymbol: string
  exchangeRateToBase: number
  countryId: number | null
  supplierInvoiceNo: string | null
  shipmentReference: string | null
  allocationMethod: AllocationMethod
  goodsTotal: number
  goodsBase: number
  costsBase: number
  landedBase: number
  receivedAt: string | null
  lines: ImportLine[]
  costs: ImportCost[]
}

export type Currency = { currencyId: number; currencyCode: string; symbol: string; currencyNameAr: string; currencyNameEn: string; isPrimary: boolean; isActive: boolean; exchangeRate: number | null }
export type Partner = { partnerId: number; partnerName: string; isSupplier: boolean }
export type Treasury = { treasuryId: number; nameAr: string; nameEn: string; currencyId: number; currencySymbol: string; isActive: boolean }
export type PayableAccount = { accountCode: string; nameAr: string; nameEn: string }
export type Country = { countryId: number; nameAr: string; nameEn: string; isActive: boolean }
export type Item = { itemId: number; itemCode?: string; nameAr: string; nameEn: string; lastPurchasePrice?: number | null }
export type Unit = { unitSettingId: number; unitAr?: string | null; unitEn?: string | null; conversionToBase: number; isBase: boolean }

// A line being edited on the screen, before it is saved. Text fields keep what the user typed.
export type DraftLine = {
  key: string
  itemId: number
  itemName: string
  unitSettingId: number | null
  unitName: string
  quantity: string
  unitPrice: string
  expiryDate: string
  batchNo: string
  barcode: string
}

export type CostDraft = {
  costType: string
  amount: string
  currencyId: string
  exchangeRate: string
  payeeType: PayeeType
  payeePartnerId: string
  payeeTreasuryId: string
  payeeAccountCode: string
  description: string
}

export const costTypes: Array<[code: string, en: string, ar: string]> = [
  ['FREIGHT', 'Freight', 'الشحن'],
  ['CUSTOMS', 'Customs duty', 'الرسوم الجمركية'],
  ['CLEARANCE', 'Customs clearance', 'التخليص الجمركي'],
  ['INSURANCE', 'Insurance', 'التأمين'],
  ['PORT', 'Port & handling', 'رسوم الميناء والمناولة'],
  ['INLAND', 'Inland transport', 'النقل الداخلي'],
  ['IMPORT_TAX_VAT', 'Import tax / VAT', 'ضريبة الاستيراد / القيمة المضافة'],
  ['BANK', 'Bank charges', 'مصاريف بنكية'],
  ['OTHER', 'Other', 'أخرى'],
]

export function costTypeLabel(code: string, ar: boolean) {
  const found = costTypes.find(([value]) => value === code)
  return found ? (ar ? found[2] : found[1]) : code
}

export function toNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

// Shares costs over lines exactly as the server does at receipt, so the preview matches what lands in stock.
export function allocate(weights: Array<{ value: number; quantity: number }>, costs: number, method: AllocationMethod) {
  const result = weights.map(() => 0)
  if (!weights.length || !costs) return result
  let shares = weights.map(weight => method === 'QUANTITY' ? weight.quantity : weight.value)
  let total = shares.reduce((sum, share) => sum + share, 0)
  if (total <= 0) { shares = weights.map(weight => weight.quantity); total = shares.reduce((sum, share) => sum + share, 0) }
  if (total <= 0) return result
  let given = 0
  shares.forEach((share, index) => {
    result[index] = index === shares.length - 1 ? costs - given : Math.round(costs * share / total * 10000) / 10000
    given += result[index]
  })
  return result
}

export async function readProblem(response: Response, fallback: string) {
  try {
    const text = await response.text()
    try { const body = JSON.parse(text) as { detail?: string; title?: string }; return body.detail ?? body.title ?? fallback } catch { return text || fallback }
  } catch { return fallback }
}

export function lineFromSaved(line: ImportLine): DraftLine {
  return {
    key: `saved-${line.purchaseLineId}`,
    itemId: line.itemId,
    itemName: line.itemName,
    unitSettingId: line.unitSettingId,
    unitName: line.unitName ?? '',
    quantity: String(line.quantity),
    unitPrice: String(line.unitPrice),
    expiryDate: line.expiryDate?.slice(0, 10) ?? '',
    batchNo: line.batchNo ?? '',
    barcode: line.barcode ?? '',
  }
}
