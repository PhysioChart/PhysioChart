export interface IInvoiceDraftItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  total: number
}

export interface IInvoiceDraft {
  patient_id: string
  treatment_plan_id: string
  treatmentItem: IInvoiceDraftItem | null
  extraItems: IInvoiceDraftItem[]
  items: IInvoiceDraftItem[]
  notes: string
  due_date: string
}

export const NO_TREATMENT_PLAN_VALUE = '__NO_TREATMENT_PLAN__'

export function createDefaultLineItem(): IInvoiceDraftItem {
  return { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0, total: 0 }
}

export function createDefaultInvoiceForm(): IInvoiceDraft {
  return {
    patient_id: '',
    treatment_plan_id: NO_TREATMENT_PLAN_VALUE,
    treatmentItem: null,
    extraItems: [],
    items: [createDefaultLineItem()],
    notes: '',
    due_date: '',
  }
}
