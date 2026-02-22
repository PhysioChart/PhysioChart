import type { Tables } from '~/types/database'

/** "2:30 pm" */
export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/** "22 Feb" */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })
}

/** "22 Feb 2026" */
export function formatDateWithYear(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** "22 February 2026" — accepts null, returns "—" */
export function formatDateLong(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** "Sat, 22 Feb 2026, 2:30 pm" */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/** "Sat, 22 Feb" — for series date preview */
export function formatSeriesDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** Progress percentage — clamped 0–100 */
export function progressPercent(completed: number, total: number): number {
  if (total === 0) return 0
  return Math.round((completed / total) * 100)
}

/** Tailwind classes for appointment/treatment/invoice status badges */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
    case 'paid':
      return 'bg-green-500/10 text-green-700'
    case 'cancelled':
      return 'bg-red-500/10 text-red-700'
    case 'overdue':
      return 'bg-red-500/10 text-red-700'
    case 'no_show':
    case 'partially_paid':
      return 'bg-amber-500/10 text-amber-700'
    case 'active':
    case 'scheduled':
    case 'draft':
    case 'sent':
      return 'bg-blue-500/10 text-blue-700'
    default:
      return 'bg-zinc-500/10 text-zinc-700'
  }
}

/** WhatsApp reminder deep link */
export function getWhatsAppLink(patient: Tables<'patients'> | null, startTime: string): string {
  if (!patient) return ''
  const phone = patient.phone.replace(/\D/g, '')
  const date = new Date(startTime)
  const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })
  const timeStr = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  const msg = encodeURIComponent(
    `Hi ${patient.full_name}, this is a reminder for your appointment on ${dateStr} at ${timeStr}. Please arrive 10 minutes early. Thank you!`,
  )
  return `https://wa.me/${phone}?text=${msg}`
}
