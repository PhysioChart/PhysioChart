/**
 * Ensure phone number includes the country code prefix.
 * Handles inputs with or without the code already present.
 *
 * Examples (countryCode = "+91"):
 *   "9876543210"       → "+919876543210"
 *   "+919876543210"    → "+919876543210"
 *   "919876543210"     → "+919876543210"
 *   "+91 98765 43210"  → "+919876543210"
 */
export function ensureCountryCode(phone: string, countryCode: string): string {
  if (!phone) return phone
  const digits = phone.replace(/\D/g, '')
  if (!digits) return phone
  const codeDigits = countryCode.replace(/\D/g, '')
  if (digits.startsWith(codeDigits)) return `+${digits}`
  return `${countryCode}${digits}`
}

/**
 * Strip the country code prefix, returning only local digits for input fields.
 *
 * Examples (countryCode = "+91"):
 *   "+919876543210"    → "9876543210"
 *   "919876543210"     → "9876543210"
 *   "9876543210"       → "9876543210"
 */
/**
 * Format phone for display with a space after the country code.
 *
 * Examples (countryCode = "+91"):
 *   "9876543210"       → "+91 9876543210"
 *   "+919876543210"    → "+91 9876543210"
 */
export function formatPhoneDisplay(phone: string, countryCode: string): string {
  if (!phone) return phone
  const withCode = ensureCountryCode(phone, countryCode)
  const codeDigits = countryCode.replace(/\D/g, '')
  const prefix = `+${codeDigits}`
  if (withCode.startsWith(prefix)) return `${prefix} ${withCode.slice(prefix.length)}`
  return withCode
}

export function stripCountryCode(phone: string, countryCode: string): string {
  if (!phone) return phone
  const digits = phone.replace(/\D/g, '')
  const codeDigits = countryCode.replace(/\D/g, '')
  if (digits.startsWith(codeDigits)) return digits.slice(codeDigits.length)
  return digits
}
