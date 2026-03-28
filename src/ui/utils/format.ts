/**
 * Format a byte count into a human-readable string.
 *
 * @param bytes  - The number of bytes
 * @param decimals - Decimal places to show (default 1)
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(decimals)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(decimals)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(Math.max(decimals, 2))} GB`
}

/**
 * Format a date value into a localized string.
 *
 * Handles both:
 * - Unix timestamps (number) — seconds since epoch, as returned by Docker APIs
 * - ISO date strings (string) — e.g. from filesystem or MongoDB
 */
export function formatDate(date: number | string): string {
  const parsed = typeof date === 'number' ? new Date(date * 1000) : new Date(date)

  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
