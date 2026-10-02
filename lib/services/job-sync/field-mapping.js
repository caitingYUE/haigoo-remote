import { cleanText, plainText } from './policy.js'

// Only explicit labels in this posting's description are evidence. Never use
// the response containing other postings or infer geography from language.
export function mapDescriptionFields(facts) {
  const text = plainText(String(facts.description || '').replace(/<\/(?:div|tr)>/gi, '\n'))
  const labels = {
    location: /^(?:job location|work location|location|工作地点|工作地址|地点)\s*[:：]\s*(.+)$/i,
    salary: /^(?:salary(?: range)?|pay(?: range| rate)?|hourly rate|rate|compensation|薪资(?:范围)?|薪酬|时薪|报酬)\s*[:：]\s*(.+)$/i,
    job_type: /^(?:job type|employment type|contract type|工作类型|雇佣类型|职位类型)\s*[:：]\s*(.+)$/i,
    schedule: /^(?:work schedule|working hours|工作时间|工作安排)\s*[:：]\s*(.+)$/i,
    timezone: /^(?:time ?zone|工作时区|时区)\s*[:：]\s*(.+)$/i
  }
  const evidence = {}
  for (const line of text.split('\n').map(cleanText).filter(Boolean)) {
    for (const [key, pattern] of Object.entries(labels)) {
      const match = line.replace(/^[•*-]\s*/, '').match(pattern)
      if (match && match[1].length <= 240 && !/^(?:n\/?a|tbc|tbd|unknown|待定|未提供)$/i.test(match[1])) {
        evidence[key] = [...new Set([...(evidence[key] || []), match[1]])]
      }
    }
  }
  const result = { ...facts }
  for (const key of ['location', 'salary', 'job_type', 'timezone']) {
    const values = evidence[key]
    // Multiple contradictory labels require a reviewer, not a guessed value.
    if (!result[key] && values?.length === 1 && (key !== 'salary' || /\d/.test(values[0]))) result[key] = values[0]
  }
  if (!result.job_type && evidence.schedule?.length === 1) {
    const type = evidence.schedule[0].match(/^(full[ -]time|part[ -]time|全职|兼职)\b/i)
    if (type) result.job_type = type[1]
  }
  const workplace = evidence.location?.join(' ') || ''
  if (result.is_remote === undefined && /^(?:remote|work from home|home[- ]based|远程(?:办公)?|居家办公)$/i.test(workplace)) result.is_remote = true
  return { ...result, field_evidence: evidence }
}

export function salaryRangeText(range) {
  if (!range || typeof range !== 'object') return undefined
  const min = range.min ?? range.minValue ?? range.value
  const max = range.max ?? range.maxValue
  const valid = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
  if (!valid(min) && !valid(max)) return undefined
  const exact = valid(range.value) && range.min === undefined && range.minValue === undefined && !valid(max)
  const amount = exact ? String(range.value) : valid(min) && valid(max) ? (Number(min) === Number(max) ? String(min) : `${min}–${max}`) : valid(min) ? `${min}+` : `≤${max}`
  return [range.currency, amount, range.interval || range.unitText].filter(Boolean).join(' ')
}
