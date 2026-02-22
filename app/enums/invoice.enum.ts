export const InvoiceStatus = {
  DRAFT: 'draft',
  SENT: 'sent',
  PAID: 'paid',
  PARTIALLY_PAID: 'partially_paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
} as const

export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus]

export const INVOICE_STATUS_VALUES = Object.values(InvoiceStatus)

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  [InvoiceStatus.DRAFT]: 'Draft',
  [InvoiceStatus.SENT]: 'Sent',
  [InvoiceStatus.PAID]: 'Paid',
  [InvoiceStatus.PARTIALLY_PAID]: 'Partially Paid',
  [InvoiceStatus.OVERDUE]: 'Overdue',
  [InvoiceStatus.CANCELLED]: 'Cancelled',
}
