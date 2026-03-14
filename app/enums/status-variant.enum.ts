import { APPOINTMENT_STATUS_LABELS } from '~/enums/appointment.enum'
import { TREATMENT_STATUS_LABELS } from '~/enums/treatment.enum'
import { INVOICE_STATUS_LABELS } from '~/enums/invoice.enum'

const STATUS_COLOR_MAP: Record<string, string> = {
  // Appointment
  scheduled: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  checked_in: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  // Shared: completed (appointment + treatment), cancelled (appointment + treatment + invoice)
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  no_show: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  // Treatment
  active: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  // Invoice
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  sent: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  partially_paid: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

const FALLBACK = 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'

export function getStatusClasses(status: string): string {
  return STATUS_COLOR_MAP[status] ?? FALLBACK
}

const STATUS_LABEL_MAP: Record<string, string> = {
  ...APPOINTMENT_STATUS_LABELS,
  ...TREATMENT_STATUS_LABELS,
  ...INVOICE_STATUS_LABELS,
}

export function getStatusLabel(status: string): string {
  return (
    STATUS_LABEL_MAP[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}
