import type { MiniCompanyJobDetail } from '../types'

export function formatJobApplicationCopy(job: MiniCompanyJobDetail, companyName: string, kind: 'url' | 'email', value: string) {
  const clean = (text?: string) => String(text || '').replace(/\s+/g, ' ').trim()
  const heading = [job.titleZh || job.title || job.titleOriginal, companyName || job.company]
    .map(clean).filter(Boolean).map((text) => `【${text}】`).join(' ')
  const metadata = [job.location, job.category, job.jobType, job.experienceLevel].map(clean).filter(Boolean).join('｜')
  return [heading, metadata, `${kind === 'email' ? '申请邮箱' : '申请链接'}：${value.trim()}`].filter(Boolean).join('\n')
}
