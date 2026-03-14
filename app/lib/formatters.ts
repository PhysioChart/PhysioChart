import type { Tables } from '~/types/database'
import { formatAppDate } from '~/lib/date'

/** "2:30 pm" */
export function formatTime(dateStr: string): string {
  return formatAppDate(dateStr, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/** "22 Feb" */
export function formatDate(dateStr: string): string {
  return formatAppDate(dateStr, {
    day: 'numeric',
    month: 'short',
  })
}

/** "22 Feb 2026" */
export function formatDateWithYear(dateStr: string): string {
  return formatAppDate(dateStr, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** "22 February 2026" — accepts null, returns "—" */
export function formatDateLong(dateStr: string | null): string {
  if (!dateStr) return '—'
  return formatAppDate(dateStr, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** "Sat, 22 Feb 2026, 2:30 pm" */
export function formatDateTime(dateStr: string): string {
  return formatAppDate(dateStr, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/** "Sat, 22 Feb" — for series date preview */
export function formatSeriesDate(dateStr: string): string {
  return formatAppDate(dateStr, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** Progress percentage — clamped 0–100 */
export function progressPercent(completed: number, total: number | null): number {
  if (!total || total <= 0) return 0
  return Math.min(Math.round((completed / total) * 100), 100)
}

/** Format currency in INR — "₹1,200" */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

/** "2h ago", "Yesterday", or fallback date */
export function formatRelativeTime(dateStr: string): string {
  const target = new Date(dateStr).getTime()
  if (Number.isNaN(target)) return formatDateTime(dateStr)
  const now = Date.now()
  const diffMs = target - now
  if (diffMs > 0 && diffMs < 60_000) return 'just now'
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const mins = Math.round(diffMs / 60_000)
  const hours = Math.round(diffMs / 3_600_000)
  const days = Math.round(diffMs / 86_400_000)
  if (Math.abs(mins) < 60) return rtf.format(mins, 'minute')
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
  if (Math.abs(days) < 7) return rtf.format(days, 'day')
  return formatDateTime(dateStr)
}

/** WhatsApp reminder deep link */
export interface AppointmentWhatsAppLinkArgs {
  patient: Tables<'patients'> | null
  startTime: string
  therapistName?: string | null
  clinicName?: string | null
}

export function getAppointmentWhatsAppLink({
  patient,
  startTime,
  therapistName,
  clinicName,
}: AppointmentWhatsAppLinkArgs): string | null {
  if (!patient) return null

  const phone = patient.phone.replace(/\D/g, '')
  if (phone.length < 10 || phone.length > 15) return null

  const patientName = patient.full_name.trim() || 'there'
  const clinicLabel = clinicName?.trim() || 'your clinic'
  const therapistLabel = therapistName?.trim() || 'our therapist'
  const dateStr = formatDate(startTime)
  const timeStr = formatTime(startTime)
  const rawMessage =
    `Hi ${patientName}, this is a reminder from ${clinicLabel} for your appointment on ` +
    `${dateStr} at ${timeStr} with ${therapistLabel}. Please arrive 10 minutes early.`

  return `https://wa.me/${phone}?text=${encodeURIComponent(rawMessage)}`
}
