export const INDIA_PHONE_PREFIX = '+91'
export const INDIA_PHONE_DIGIT_LIMIT = 10
const INDIAN_MOBILE_PHONE_PATTERN = /^[6-9]\d{9}$/

export function extractIndianPhoneDigits(value: string | null | undefined): string {
  if (!value) return ''

  let digits = value.replace(/\D/g, '').replace(/^0+/, '')

  if (digits.startsWith('91') && digits.length > INDIA_PHONE_DIGIT_LIMIT) {
    digits = digits.slice(2)
  }

  return digits.slice(0, INDIA_PHONE_DIGIT_LIMIT)
}

export function normalizeIndianPhone(value: string | null | undefined): string {
  const digits = extractIndianPhoneDigits(value)
  return digits ? `${INDIA_PHONE_PREFIX}${digits}` : ''
}

export function isValidIndianPhone(value: string | null | undefined): boolean {
  const digits = extractIndianPhoneDigits(value)
  return INDIAN_MOBILE_PHONE_PATTERN.test(digits)
}

export function formatIndianPhoneDisplay(value: string | null | undefined): string {
  const normalized = normalizeIndianPhone(value)
  return normalized || '—'
}

export function toWhatsAppPhone(value: string | null | undefined): string | null {
  const digits = extractIndianPhoneDigits(value)
  if (!INDIAN_MOBILE_PHONE_PATTERN.test(digits)) return null
  return `91${digits}`
}
