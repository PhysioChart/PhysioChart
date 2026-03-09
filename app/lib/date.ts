const APP_LOCALE = 'en-IN'
const CLINIC_TIME_ZONE = 'Asia/Kolkata'
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isDateOnlyString(value: string): boolean {
  return DATE_ONLY_PATTERN.test(value)
}

function getDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value ?? '0000'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  const day = parts.find((part) => part.type === 'day')?.value ?? '01'

  return { year, month, day }
}

export function resolveDateInput(dateInput: Date | string): { date: Date; timeZone: string } {
  if (dateInput instanceof Date) {
    return { date: dateInput, timeZone: CLINIC_TIME_ZONE }
  }

  if (isDateOnlyString(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number)
    return {
      date: new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)),
      timeZone: 'UTC',
    }
  }

  return { date: new Date(dateInput), timeZone: CLINIC_TIME_ZONE }
}

export function formatAppDate(
  dateInput: Date | string,
  options: Intl.DateTimeFormatOptions,
): string {
  const { date, timeZone } = resolveDateInput(dateInput)

  return new Intl.DateTimeFormat(APP_LOCALE, {
    ...options,
    timeZone,
  }).format(date)
}

export function toLocalDateKey(dateInput: Date | string): string {
  const { date, timeZone } = resolveDateInput(dateInput)
  const { year, month, day } = getDateParts(date, timeZone)
  return `${year}-${month}-${day}`
}

export function toDateInputValue(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function toLocalNoonIso(dateInput: string): string {
  const localNoon = new Date(`${dateInput}T12:00:00`)
  return localNoon.toISOString()
}
