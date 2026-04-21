export type SupportedSalaryCurrency = 'USD' | 'EUR' | 'CNY'
export type SupportedSalaryPeriod = 'hourly' | 'monthly' | 'yearly' | 'package'
export type SupportedSalaryValueMode = 'fixed' | 'range'

export interface StructuredSalaryValue {
  min?: number
  max?: number
  currency?: string
  period?: string
  valueMode?: string
  display?: string
}

export interface NormalizedSalary {
  kind: 'structured' | 'legacy' | 'open'
  raw: string
  structured?: {
    min?: number
    max?: number
    currency: SupportedSalaryCurrency
    period: SupportedSalaryPeriod
    valueMode: SupportedSalaryValueMode
  }
}

const OPEN_VALUES = new Set(['', '0', '0-0', 'null', 'open', 'competitive', 'unspecified', '薪资open', '薪资面议', '面议'])

export const SALARY_PERIOD_OPTIONS: Array<{ value: SupportedSalaryPeriod; label: string; shortLabel: string }> = [
  { value: 'hourly', label: '时薪', shortLabel: '时' },
  { value: 'monthly', label: '月薪', shortLabel: '月' },
  { value: 'yearly', label: '年薪', shortLabel: '年' },
  { value: 'package', label: '总包', shortLabel: '总' }
]

export const SALARY_CURRENCY_OPTIONS: Array<{ value: SupportedSalaryCurrency; label: string; symbol: string }> = [
  { value: 'USD', label: '美元', symbol: '$' },
  { value: 'EUR', label: '欧元', symbol: '€' },
  { value: 'CNY', label: '人民币', symbol: '¥' }
]

export function getSalaryCurrencySymbol(currency?: string): string {
  if (currency === 'USD') return '$'
  if (currency === 'EUR') return '€'
  if (currency === 'CNY') return '¥'
  return currency || ''
}

export function getSalaryPeriodShortLabel(period?: string): string {
  const found = SALARY_PERIOD_OPTIONS.find((item) => item.value === period)
  return found?.shortLabel || ''
}

function parseNumberToken(token: string): number | null {
  if (!token) return null
  const normalized = token.replace(/,/g, '').trim().toLowerCase()
  const match = normalized.match(/^(\d+(?:\.\d+)?)(k|w|万)?$/)
  if (!match) return null
  const base = Number(match[1])
  if (!Number.isFinite(base)) return null
  const unit = match[2]
  if (unit === 'k') return base * 1000
  if (unit === 'w' || unit === '万') return base * 10000
  return base
}

function abbreviateAmount(value?: number): string {
  if (!value || !Number.isFinite(value)) return ''
  if (value >= 1000) {
    const compact = value / 1000
    const rounded = compact >= 100 ? compact.toFixed(0) : Number.isInteger(compact) ? compact.toFixed(0) : compact.toFixed(1)
    return `${rounded}k`
  }
  return String(Math.round(value))
}

function inferCurrency(text: string): SupportedSalaryCurrency | null {
  const raw = text.toLowerCase()
  if (raw.includes('€') || raw.includes('eur')) return 'EUR'
  if (raw.includes('¥') || raw.includes('￥') || raw.includes('cny') || raw.includes('rmb') || raw.includes('人民币')) return 'CNY'
  if (raw.includes('$') || raw.includes('usd')) return 'USD'
  return null
}

function inferPeriod(text: string): SupportedSalaryPeriod | null {
  const raw = text.toLowerCase()
  if (raw.includes('总包') || raw.includes('package') || raw.includes('pkg') || raw.includes('tc')) return 'package'
  if (raw.includes('/小时') || raw.includes('/h') || raw.includes('hour')) return 'hourly'
  if (raw.includes('/月') || raw.includes('month') || raw.includes('/mo')) return 'monthly'
  if (raw.includes('/年') || raw.includes('year') || raw.includes('annual') || raw.includes('/yr')) return 'yearly'
  return null
}

function normalizeStructuredSalary(input: StructuredSalaryValue): NormalizedSalary | null {
  const currency = (String(input.currency || '').toUpperCase() || 'USD') as SupportedSalaryCurrency
  const period = (String(input.period || 'yearly').toLowerCase() || 'yearly') as SupportedSalaryPeriod
  const valueMode = (String(input.valueMode || '').toLowerCase() === 'fixed' || Number(input.min) === Number(input.max))
    ? 'fixed'
    : 'range'

  const min = Number(input.min)
  const max = Number(input.max)
  const hasMin = Number.isFinite(min) && min > 0
  const hasMax = Number.isFinite(max) && max > 0

  if (!hasMin && !hasMax) {
    return {
      kind: 'open',
      raw: String(input.display || '')
    }
  }

  return {
    kind: 'structured',
    raw: JSON.stringify(input),
    structured: {
      min: hasMin ? min : undefined,
      max: hasMax ? max : undefined,
      currency: ['USD', 'EUR', 'CNY'].includes(currency) ? currency : 'USD',
      period: ['hourly', 'monthly', 'yearly', 'package'].includes(period) ? period : 'yearly',
      valueMode
    }
  }
}

export function normalizeSalary(input: unknown): NormalizedSalary {
  if (input == null) return { kind: 'open', raw: '' }

  if (typeof input === 'object') {
    const structured = normalizeStructuredSalary(input as StructuredSalaryValue)
    if (structured) return structured
  }

  const raw = String(input || '').trim()
  if (OPEN_VALUES.has(raw.toLowerCase())) return { kind: 'open', raw }

  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw)
      const structured = normalizeStructuredSalary(parsed)
      if (structured) return structured
    } catch (_error) {
      // Keep legacy text.
    }
  }

  const currency = inferCurrency(raw)
  const period = inferPeriod(raw)
  const matches = raw.match(/\d+(?:\.\d+)?(?:k|w|万)?/gi) || []
  const numbers = matches.map(parseNumberToken).filter((value): value is number => Number.isFinite(value))

  if (currency && period && numbers.length > 0) {
    const min = numbers[0]
    const max = numbers[1] || numbers[0]
    return {
      kind: 'structured',
      raw,
      structured: {
        min,
        max,
        currency,
        period,
        valueMode: numbers.length > 1 && numbers[1] !== numbers[0] ? 'range' : 'fixed'
      }
    }
  }

  return { kind: 'legacy', raw }
}

export function formatStructuredSalaryCompact(structured?: NormalizedSalary['structured']): string {
  if (!structured) return '薪资面议'
  const symbol = getSalaryCurrencySymbol(structured.currency)
  const suffix = getSalaryPeriodShortLabel(structured.period)
  const minText = abbreviateAmount(structured.min)
  const maxText = abbreviateAmount(structured.max)
  const isFixed = structured.valueMode === 'fixed' || !structured.max || structured.max === structured.min
  if (!minText && !maxText) return '薪资面议'
  if (isFixed) {
    return `${symbol}${minText || maxText}${suffix ? `/${suffix}` : ''}`
  }
  return `${symbol}${minText}–${symbol}${maxText}${suffix ? `/${suffix}` : ''}`
}

export function formatSalaryForDisplay(input: unknown, openLabel = '薪资面议'): string {
  const normalized = normalizeSalary(input)
  if (normalized.kind === 'open') return openLabel
  if (normalized.kind === 'legacy') return normalized.raw || openLabel
  return formatStructuredSalaryCompact(normalized.structured) || openLabel
}

export function serializeSalaryForStorage(input: unknown): string {
  const normalized = normalizeSalary(input)
  if (normalized.kind === 'structured' && normalized.structured) {
    return JSON.stringify({
      min: normalized.structured.min,
      max: normalized.structured.max,
      currency: normalized.structured.currency,
      period: normalized.structured.period,
      valueMode: normalized.structured.valueMode
    })
  }
  if (normalized.kind === 'legacy') return normalized.raw
  return '薪资Open'
}
