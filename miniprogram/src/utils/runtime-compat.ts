function twoDigits(value: number) {
  return value < 10 ? `0${value}` : String(value)
}

export function validDate(value?: string | number | null) {
  const date = new Date(value == null ? '' : value)
  return Number.isFinite(date.getTime()) ? date : null
}

export function formatCalendarDate(value?: string | number | null, separator = '.') {
  const date = validDate(value)
  if (!date) return ''
  return [date.getFullYear(), twoDigits(date.getMonth() + 1), twoDigits(date.getDate())].join(separator)
}

export function formatMonthDayTime(value?: string | number | null) {
  const date = validDate(value)
  if (!date) return ''
  return `${twoDigits(date.getMonth() + 1)}.${twoDigits(date.getDate())} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`
}

export function normalizeComparableText(value: unknown) {
  return String(value == null ? '' : value).toLowerCase().trim()
}
