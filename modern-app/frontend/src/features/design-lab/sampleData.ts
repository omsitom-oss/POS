export type Product = {
  id: string
  name: string
  generic: string
  category: string
  pack: string
  stock: number
  price: number
  expiryDate: string
  status: 'In stock' | 'Low stock' | 'Out of stock'
}

export const products: Product[] = [
  { id: 'MED-10482', name: 'Paracetamol 500 mg', generic: 'Paracetamol', category: 'Analgesics', pack: '20 tablets', stock: 146, price: 8.5, expiryDate: '2027-02-01', status: 'In stock' },
  { id: 'MED-20831', name: 'Amoxicillin 500 mg', generic: 'Amoxicillin', category: 'Antibiotic', pack: '21 capsules', stock: 38, price: 24, expiryDate: '2027-04-15', status: 'In stock' },
  { id: 'MED-31016', name: 'Vitamin D3 1000 IU', generic: 'Cholecalciferol', category: 'Vitamins', pack: '30 capsules', stock: 12, price: 18.75, expiryDate: '2027-06-30', status: 'Low stock' },
  { id: 'MED-44620', name: 'Cetirizine 10 mg', generic: 'Cetirizine', category: 'Allergy', pack: '10 tablets', stock: 82, price: 11, expiryDate: '2028-01-10', status: 'In stock' },
  { id: 'MED-51709', name: 'Omeprazole 20 mg', generic: 'Omeprazole', category: 'Digestive health', pack: '14 capsules', stock: 6, price: 16.5, expiryDate: '2027-08-31', status: 'Low stock' },
  { id: 'MED-62348', name: 'Ibuprofen 400 mg', generic: 'Ibuprofen', category: 'Analgesics', pack: '20 tablets', stock: 0, price: 12, expiryDate: '2027-09-20', status: 'Out of stock' },
  { id: 'MED-70935', name: 'Saline Nasal Spray', generic: 'Sodium chloride', category: 'Respiratory', pack: '100 ml', stock: 25, price: 19.25, expiryDate: '2028-03-01', status: 'In stock' },
  { id: 'MED-81562', name: 'Antacid Suspension', generic: 'Aluminium hydroxide', category: 'Digestive health', pack: '200 ml', stock: 41, price: 14, expiryDate: '2027-11-01', status: 'In stock' },
  { id: 'MED-90174', name: 'Multivitamin Daily', generic: 'Multivitamins', category: 'Vitamins', pack: '30 tablets', stock: 17, price: 32.5, expiryDate: '2028-02-15', status: 'In stock' },
]

export type SaleLine = { id: number; name: string; unit: string; quantity: number; price: number; discount: number }

export const saleLines: SaleLine[] = [
  { id: 1, name: 'Paracetamol 500 mg', unit: '20 tablets', quantity: 2, price: 8.5, discount: 0 },
  { id: 2, name: 'Vitamin D3 1000 IU', unit: '30 capsules', quantity: 1, price: 18.75, discount: 1.25 },
  { id: 3, name: 'Saline Nasal Spray', unit: '100 ml', quantity: 1, price: 19.25, discount: 0 },
]

export const customers = [
  { id: 'C-1008', name: 'Maya Hassan', phone: '+971 50 123 4510', balance: 0 },
  { id: 'C-1014', name: 'Omar Khalid', phone: '+971 55 240 8891', balance: 86.5 },
  { id: 'C-1042', name: 'Sara Nasser', phone: '+971 52 901 2440', balance: -22 },
  { id: 'C-1087', name: 'Noor Ibrahim', phone: '+971 56 480 3312', balance: 0 },
]
