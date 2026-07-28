import type { MiniJob } from '../types'

export type ApplicationMethod = 'website' | 'email'

export interface ApplicationMethodOption {
  type: ApplicationMethod
  label: string
  shortLabel: string
}
export function resolveDirectEmailLabel(rawType?: string): string {
  const emailType = String(rawType || '').trim()
  const haystack = `${emailType.toLowerCase()} ${emailType}`

  if (/(boss|ceo|chief|founder|vp|head|director|executive|高管|老板|创始|负责人)/i.test(haystack)) {
    return 'BOSS邮箱直申'
  }
  if (/(hr|human resources|people|人力|人事|hr邮箱)/i.test(haystack)) {
    return 'HR邮箱直申'
  }
  if (/(招聘|recruit|recruiter|hiring|career|talent|talent acquisition)/i.test(haystack)) {
    return '招聘邮箱直申'
  }
  if (/(员工|employee|staff|teammate|team)/i.test(haystack)) {
    return '员工邮箱直申'
  }
  if (emailType.endsWith('邮箱')) return `${emailType}直申`
  return '邮箱直申'
}

export function getApplicationMethods(job: MiniJob): ApplicationMethodOption[] {
  const methods: ApplicationMethodOption[] = []
  if (job.application.hasWebsiteApply) {
    methods.push({ type: 'website', label: '官网申请', shortLabel: '官网申请' })
  }
  if (job.application.hasEmailApply) {
    const label = resolveDirectEmailLabel(job.application.emailType)
    methods.push({ type: 'email', label, shortLabel: label })
  }
  return methods
}
