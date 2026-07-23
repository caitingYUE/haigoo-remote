import type { JobDetailSection, MiniJob } from '../types'

const HEADING_RULES: Array<{ title: string; pattern: RegExp }> = [
  { title: '岗位介绍', pattern: /^(about the role|about this role|role overview|position overview|job description|the role|岗位介绍|职位描述|岗位概述|职位概述|概述)[:：]?$/i },
  { title: '岗位职责', pattern: /^(responsibilities|key responsibilities|what you(?:'|’)ll do|what you will do|a typical day|your impact|岗位职责|工作职责|工作内容|你会做什么|你将做什么|典型的一天)[:：]?$/i },
  { title: '任职要求', pattern: /^(requirements|qualifications|your expertise|what you bring|what we(?:'|’)re looking for|what we are looking for|任职要求|职位要求|岗位要求|资格要求|你的专长|您的专业知识|你带来什么)[:：]?$/i },
  { title: '加分项', pattern: /^(preferred qualifications|preferred|nice to have|bonus points|加分项|优先条件)[:：]?$/i },
  { title: '福利待遇', pattern: /^(benefits|benefits and perks|what we offer|why join us|what you(?:'|’)ll get|福利待遇|员工福利|我们提供什么|为什么加入我们)[:：]?$/i },
  { title: '公司介绍', pattern: /^(about us|about the company|who we are|company overview|关于我们|公司介绍|企业介绍|我们是谁)[:：]?$/i }
]

function cleanLine(value: string): string {
  return value
    .replace(/^[-*•]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function resolveHeading(value: string): string | null {
  const normalized = cleanLine(value)
  const found = HEADING_RULES.find((rule) => rule.pattern.test(normalized))
  return found ? found.title : null
}

function splitText(value: string): string[] {
  return value
    .replace(/\r/g, '')
    .split(/\n+/)
    .map(cleanLine)
    .filter(Boolean)
}

export function buildJobDetailSections(job: MiniJob): JobDetailSection[] {
  const sections: JobDetailSection[] = []
  const sectionMap = new Map<string, JobDetailSection>()

  const ensureSection = (title: string) => {
    const existing = sectionMap.get(title)
    if (existing) return existing
    const next: JobDetailSection = {
      id: `${sections.length}-${title}`,
      title,
      paragraphs: [],
      items: []
    }
    sectionMap.set(title, next)
    sections.push(next)
    return next
  }

  if (job.description) {
    let current = ensureSection('岗位介绍')
    splitText(job.description).forEach((line) => {
      const heading = resolveHeading(line)
      if (heading) {
        current = ensureSection(heading)
        return
      }

      if (line.length <= 180 && /[。.!?]$/.test(line)) {
        current.paragraphs.push(line)
      } else if (line.length <= 150) {
        current.items.push(line)
      } else {
        current.paragraphs.push(line)
      }
    })
  }

  const appendItems = (title: string, items: string[]) => {
    if (items.length === 0) return
    const section = ensureSection(title)
    items.forEach((item) => {
      const normalized = cleanLine(item)
      if (normalized && !section.items.includes(normalized)) section.items.push(normalized)
    })
  }

  appendItems('岗位职责', job.responsibilities)
  appendItems('任职要求', job.requirements)
  appendItems('福利待遇', job.benefits)

  return sections.filter((section) => section.paragraphs.length > 0 || section.items.length > 0)
}
