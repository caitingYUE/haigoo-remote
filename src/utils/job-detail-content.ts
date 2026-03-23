export type JobDetailCanonicalTitle =
  | 'overview'
  | 'responsibilities'
  | 'requirements'
  | 'preferred'
  | 'benefits'
  | 'company'
  | 'team'
  | 'compensation'
  | 'apply'
  | 'details'

export type JobDetailBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'subheading'; text: string }
  | { type: 'note'; text: string }

export interface JobDetailSection {
  id: string
  canonicalTitle: JobDetailCanonicalTitle
  rawTitle?: string
  displayTitle: string
  blocks: JobDetailBlock[]
  translatedBlocks?: JobDetailBlock[]
  activeBlocks: JobDetailBlock[]
  source: 'description' | 'responsibilities' | 'requirements' | 'benefits' | 'fallback'
}

interface ParsedSection {
  canonicalTitle: JobDetailCanonicalTitle
  rawTitle?: string
  displayTitle: string
  blocks: JobDetailBlock[]
  translatedBlocks?: JobDetailBlock[]
  activeBlocks?: JobDetailBlock[]
  source: JobDetailSection['source']
  orderHint: number
}

interface BuildJobDetailSectionsInput {
  description?: string
  translatedDescription?: string
  requirements?: string[]
  translatedRequirements?: string[]
  responsibilities?: string[]
  translatedResponsibilities?: string[]
  benefits?: string[]
  translatedBenefits?: string[]
  preferTranslated?: boolean
}

const SECTION_ORDER: Record<JobDetailCanonicalTitle, number> = {
  overview: 10,
  responsibilities: 20,
  requirements: 30,
  preferred: 40,
  benefits: 50,
  compensation: 60,
  company: 70,
  team: 75,
  apply: 80,
  details: 90
}

const CANONICAL_TITLES: Record<JobDetailCanonicalTitle, string> = {
  overview: '岗位介绍',
  responsibilities: '岗位职责',
  requirements: '任职要求',
  preferred: '加分项',
  benefits: '福利待遇',
  company: '公司介绍',
  team: '团队介绍',
  compensation: '薪资说明',
  apply: '申请方式',
  details: '职位详情'
}

const STRONG_HEADING_RULES: Array<{ canonicalTitle: JobDetailCanonicalTitle; patterns: RegExp[] }> = [
  {
    canonicalTitle: 'responsibilities',
    patterns: [
      /^responsibilities?$/i,
      /^key responsibilities$/i,
      /^what you(?:'| wi)?ll do$/i,
      /^what you will do$/i,
      /^what you'll be doing$/i,
      /^duties$/i,
      /^your role$/i,
      /^your impact$/i,
      /^day[- ]to[- ]day$/i,
      /^岗位职责$/,
      /^工作职责$/,
      /^职责范围$/,
      /^工作内容$/
    ]
  },
  {
    canonicalTitle: 'requirements',
    patterns: [
      /^requirements?$/i,
      /^qualifications?$/i,
      /^minimum qualifications?$/i,
      /^what you need$/i,
      /^what we're looking for$/i,
      /^what we are looking for$/i,
      /^who you are$/i,
      /^you bring$/i,
      /^your profile$/i,
      /^must[- ]have$/i,
      /^skills required$/i,
      /^任职要求$/,
      /^职位要求$/,
      /^岗位要求$/,
      /^资格要求$/,
      /^技能要求$/
    ]
  },
  {
    canonicalTitle: 'preferred',
    patterns: [
      /^preferred$/i,
      /^preferred qualifications?$/i,
      /^nice to have$/i,
      /^bonus points$/i,
      /^pluses$/i,
      /^good to have$/i,
      /^加分项$/,
      /^优先条件$/,
      /^优先考虑$/
    ]
  },
  {
    canonicalTitle: 'benefits',
    patterns: [
      /^benefits?$/i,
      /^perks$/i,
      /^what we offer$/i,
      /^why join us$/i,
      /^what you'll get$/i,
      /^福利待遇$/,
      /^我们提供$/,
      /^员工福利$/,
      /^薪资福利$/
    ]
  },
  {
    canonicalTitle: 'overview',
    patterns: [
      /^job description$/i,
      /^role overview$/i,
      /^position overview$/i,
      /^about the role$/i,
      /^about this role$/i,
      /^the role$/i,
      /^overview$/i,
      /^岗位介绍$/,
      /^职位描述$/,
      /^岗位概述$/,
      /^职位概述$/
    ]
  },
  {
    canonicalTitle: 'company',
    patterns: [
      /^about us$/i,
      /^about the company$/i,
      /^who we are$/i,
      /^company overview$/i,
      /^关于我们$/,
      /^公司介绍$/,
      /^企业介绍$/
    ]
  },
  {
    canonicalTitle: 'team',
    patterns: [/^about the team$/i, /^team$/i, /^our team$/i, /^团队介绍$/]
  },
  {
    canonicalTitle: 'compensation',
    patterns: [/^compensation$/i, /^salary$/i, /^pay range$/i, /^薪资$/]
  },
  {
    canonicalTitle: 'apply',
    patterns: [
      /^how to apply$/i,
      /^application process$/i,
      /^hiring process$/i,
      /^next steps$/i,
      /^申请方式$/,
      /^投递方式$/,
      /^招聘流程$/
    ]
  }
]

const NOTE_PREFIX = /^(note|please note|备注|注意)[:：]\s*/i

export function buildJobDetailSections(input: BuildJobDetailSectionsInput): JobDetailSection[] {
  const originalDescription = normalizeInputText(input.description)
  const translatedDescription = normalizeInputText(input.translatedDescription)

  const descriptionSections = parseDescriptionSections(originalDescription)
  const mergedSections = mergeStructuredSections({
    descriptionSections,
    responsibilities: toCleanLines(input.responsibilities),
    requirements: toCleanLines(input.requirements),
    benefits: toCleanLines(input.benefits)
  })

  const translationStrategy = resolveTranslatedDescriptionStrategy({
    originalDescription,
    translatedDescription,
    descriptionSections,
    mergedSections
  })

  const translatedSections = attachTranslatedBlocks({
    baseSections: translationStrategy.baseSections,
    translatedDescriptionSections: translationStrategy.translatedDescriptionSections,
    translatedResponsibilities: toCleanLines(input.translatedResponsibilities),
    translatedRequirements: toCleanLines(input.translatedRequirements),
    translatedBenefits: toCleanLines(input.translatedBenefits),
    preferTranslated: Boolean(input.preferTranslated)
  })

  if (!translatedSections.length) {
    return [createFallbackSection('暂无描述')]
  }

  return translatedSections.map((section, index) => ({
    id: `${section.canonicalTitle}-${index}`,
    canonicalTitle: section.canonicalTitle,
    rawTitle: section.rawTitle,
    displayTitle: section.displayTitle,
    blocks: section.blocks,
    translatedBlocks: section.translatedBlocks,
    activeBlocks: section.activeBlocks || section.blocks,
    source: section.source
  }))
}

function resolveTranslatedDescriptionStrategy(input: {
  originalDescription: string
  translatedDescription: string
  descriptionSections: ParsedSection[]
  mergedSections: ParsedSection[]
}): { baseSections: ParsedSection[]; translatedDescriptionSections: ParsedSection[] } {
  if (!input.translatedDescription) {
    return { baseSections: input.mergedSections, translatedDescriptionSections: [] }
  }

  if (!shouldUseTranslatedDescription(input.originalDescription, input.translatedDescription, input.descriptionSections)) {
    return { baseSections: input.mergedSections, translatedDescriptionSections: [] }
  }

  const translatedDescriptionSections = parseDescriptionSections(input.translatedDescription)
  const originalDescriptionSections = input.mergedSections.filter(section => section.source === 'description' || section.source === 'fallback')

  if (originalDescriptionSections.length <= 1 || translatedDescriptionSections.length >= originalDescriptionSections.length) {
    return {
      baseSections: input.mergedSections,
      translatedDescriptionSections
    }
  }

  return {
    baseSections: collapseDescriptionSections(input.mergedSections),
    translatedDescriptionSections: collapseParsedSections(translatedDescriptionSections)
  }
}

export function flattenSectionBlocks(blocks: JobDetailBlock[]): string {
  return blocks
    .map(block => {
      if (block.type === 'list') {
        return block.items.map(item => `- ${item}`).join('\n')
      }
      return block.text
    })
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

function createFallbackSection(text: string): JobDetailSection {
  const content = String(text || '').trim() || '暂无描述'
  const blocks: JobDetailBlock[] = [{ type: 'paragraph', text: content }]
  return {
    id: 'details-0',
    canonicalTitle: 'details',
    rawTitle: undefined,
    displayTitle: CANONICAL_TITLES.details,
    blocks,
    translatedBlocks: undefined,
    activeBlocks: blocks,
    source: 'fallback'
  }
}

function parseDescriptionSections(description: string): ParsedSection[] {
  const normalized = sanitizeDescription(description)
  if (!normalized) return []

  const lines = normalized.split('\n')
  const sections: ParsedSection[] = []
  let currentSection = createEmptySection('overview', 'description', 0)
  let paragraphBuffer: string[] = []
  let listBuffer: string[] = []
  let listOrdered = false

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return
    const text = joinParagraphLines(paragraphBuffer)
    if (text) {
      currentSection.blocks.push(createTextBlock(text))
    }
    paragraphBuffer = []
  }

  const flushList = () => {
    if (!listBuffer.length) return
    currentSection.blocks.push({
      type: 'list',
      items: dedupeStrings(listBuffer),
      ordered: listOrdered
    })
    listBuffer = []
    listOrdered = false
  }

  const flushSection = () => {
    flushParagraph()
    flushList()
    if (currentSection.blocks.length) {
      sections.push(currentSection)
    }
  }

  for (const rawLine of lines) {
    const line = normalizeLine(rawLine)
    if (!line) {
      flushParagraph()
      flushList()
      continue
    }

    const heading = detectHeading(line)
    if (heading) {
      flushSection()
      currentSection = createEmptySection(heading.canonicalTitle, 'description', sections.length)
      currentSection.rawTitle = heading.rawTitle
      currentSection.displayTitle = heading.displayTitle
      continue
    }

    const bullet = extractListItem(line)
    if (bullet) {
      flushParagraph()
      listOrdered = listOrdered || bullet.ordered
      listBuffer.push(bullet.text)
      continue
    }

    if (looksLikeStandaloneSubheading(line, currentSection)) {
      flushParagraph()
      flushList()
      currentSection.blocks.push({ type: 'subheading', text: normalizeHeadingText(line) })
      continue
    }

    paragraphBuffer.push(line)
  }

  flushSection()

  const meaningfulSections = sections.filter(section => hasMeaningfulContent(section.blocks))
  if (!meaningfulSections.length) {
    return [createEmptySection('details', 'fallback', 0, [{ type: 'paragraph', text: normalized }])]
  }

  return mergeAdjacentSections(meaningfulSections)
}

function mergeStructuredSections(input: {
  descriptionSections: ParsedSection[]
  responsibilities: string[]
  requirements: string[]
  benefits: string[]
}): ParsedSection[] {
  const descriptionSections = [...input.descriptionSections]
  const structuredSections: ParsedSection[] = []

  const structuredEntries: Array<{ canonicalTitle: JobDetailCanonicalTitle; source: ParsedSection['source']; items: string[] }> = [
    { canonicalTitle: 'responsibilities', source: 'responsibilities', items: input.responsibilities },
    { canonicalTitle: 'requirements', source: 'requirements', items: input.requirements },
    { canonicalTitle: 'benefits', source: 'benefits', items: input.benefits }
  ]

  structuredEntries.forEach((entry, entryIndex) => {
    if (!entry.items.length) return
    const descIndex = descriptionSections.findIndex(section => section.canonicalTitle === entry.canonicalTitle)
    const matchedDescription = descIndex >= 0 ? descriptionSections.splice(descIndex, 1)[0] : null
    const mergedBlocks = mergeBlocks(
      [{ type: 'list', items: entry.items }],
      matchedDescription?.blocks || []
    )

    structuredSections.push({
      canonicalTitle: entry.canonicalTitle,
      rawTitle: matchedDescription?.rawTitle,
      displayTitle: CANONICAL_TITLES[entry.canonicalTitle],
      blocks: mergedBlocks,
      source: entry.source,
      orderHint: SECTION_ORDER[entry.canonicalTitle] + entryIndex
    })
  })

  const combined = [...descriptionSections, ...structuredSections]
    .filter(section => hasMeaningfulContent(section.blocks))
    .sort((a, b) => {
      const orderDiff = SECTION_ORDER[a.canonicalTitle] - SECTION_ORDER[b.canonicalTitle]
      if (orderDiff !== 0) return orderDiff
      return a.orderHint - b.orderHint
    })

  return mergeAdjacentSections(combined)
}

function attachTranslatedBlocks(input: {
  baseSections: ParsedSection[]
  translatedDescriptionSections: ParsedSection[]
  translatedResponsibilities: string[]
  translatedRequirements: string[]
  translatedBenefits: string[]
  preferTranslated: boolean
}): ParsedSection[] {
  const translatedPools = new Map<JobDetailCanonicalTitle, ParsedSection[]>()
  input.translatedDescriptionSections.forEach(section => {
    const pool = translatedPools.get(section.canonicalTitle) || []
    pool.push(section)
    translatedPools.set(section.canonicalTitle, pool)
  })

  const structuredTranslations: Partial<Record<JobDetailCanonicalTitle, JobDetailBlock[]>> = {}
  if (input.translatedResponsibilities.length) {
    structuredTranslations.responsibilities = [{ type: 'list', items: input.translatedResponsibilities }]
  }
  if (input.translatedRequirements.length) {
    structuredTranslations.requirements = [{ type: 'list', items: input.translatedRequirements }]
  }
  if (input.translatedBenefits.length) {
    structuredTranslations.benefits = [{ type: 'list', items: input.translatedBenefits }]
  }

  return input.baseSections.map((section, index) => {
    const translatedBlocks = structuredTranslations[section.canonicalTitle] || pullTranslatedBlocks(section, translatedPools, index)
    const activeBlocks = input.preferTranslated && translatedBlocks && hasMeaningfulContent(translatedBlocks)
      ? translatedBlocks
      : section.blocks

    return {
      ...section,
      translatedBlocks,
      activeBlocks
    }
  })
}

function pullTranslatedBlocks(
  section: ParsedSection,
  translatedPools: Map<JobDetailCanonicalTitle, ParsedSection[]>,
  index: number
): JobDetailBlock[] | undefined {
  const directMatch = shiftedPoolTake(translatedPools, section.canonicalTitle)
  if (directMatch && hasMeaningfulContent(directMatch.blocks)) {
    return directMatch.blocks
  }

  if (section.canonicalTitle === 'overview' || section.canonicalTitle === 'details') {
    const fallback = shiftedPoolTake(translatedPools, 'details') || shiftedPoolTake(translatedPools, 'overview')
    if (fallback && hasMeaningfulContent(fallback.blocks)) {
      return fallback.blocks
    }
  }

  if (index === 0) {
    const firstAvailable = firstPoolTake(translatedPools)
    if (firstAvailable && hasMeaningfulContent(firstAvailable.blocks)) {
      return firstAvailable.blocks
    }
  }

  return undefined
}

function shiftedPoolTake(poolMap: Map<JobDetailCanonicalTitle, ParsedSection[]>, key: JobDetailCanonicalTitle): ParsedSection | undefined {
  const pool = poolMap.get(key)
  if (!pool || !pool.length) return undefined
  return pool.shift()
}

function firstPoolTake(poolMap: Map<JobDetailCanonicalTitle, ParsedSection[]>): ParsedSection | undefined {
  for (const pool of poolMap.values()) {
    if (pool.length) return pool.shift()
  }
  return undefined
}

function mergeAdjacentSections(sections: ParsedSection[]): ParsedSection[] {
  return sections.reduce<ParsedSection[]>((result, section) => {
    const previous = result[result.length - 1]
    if (!previous || previous.canonicalTitle !== section.canonicalTitle) {
      result.push(section)
      return result
    }

    const mergedBlocks = [...previous.blocks]
    if (section.rawTitle && section.rawTitle !== previous.rawTitle) {
      mergedBlocks.push({ type: 'subheading', text: section.rawTitle })
    }
    mergedBlocks.push(...section.blocks)

    previous.blocks = normalizeBlocks(mergedBlocks)
    return result
  }, [])
}

function collapseDescriptionSections(sections: ParsedSection[]): ParsedSection[] {
  const descriptionSections = sections.filter(section => section.source === 'description' || section.source === 'fallback')
  if (descriptionSections.length <= 1) return sections

  const nonDescriptionSections = sections.filter(section => section.source !== 'description' && section.source !== 'fallback')
  const collapsedDescription = collapseParsedSections(descriptionSections)

  return [...nonDescriptionSections, ...collapsedDescription].sort((a, b) => {
    const orderDiff = SECTION_ORDER[a.canonicalTitle] - SECTION_ORDER[b.canonicalTitle]
    if (orderDiff !== 0) return orderDiff
    return a.orderHint - b.orderHint
  })
}

function collapseParsedSections(sections: ParsedSection[]): ParsedSection[] {
  if (!sections.length) return []
  if (sections.length === 1) return sections

  const first = sections[0]
  const canonicalTitle: JobDetailCanonicalTitle = first.canonicalTitle === 'overview' ? 'overview' : 'details'
  const blocks = sections.flatMap((section, index) => {
    const prefixBlocks: JobDetailBlock[] = []
    if (index > 0 && section.rawTitle && section.rawTitle !== first.rawTitle) {
      prefixBlocks.push({ type: 'subheading', text: section.rawTitle })
    }
    return [...prefixBlocks, ...section.blocks]
  })

  return [{
    canonicalTitle,
    rawTitle: first.rawTitle,
    displayTitle: CANONICAL_TITLES[canonicalTitle],
    blocks: normalizeBlocks(blocks),
    source: first.source,
    orderHint: SECTION_ORDER[canonicalTitle]
  }]
}

function mergeBlocks(primaryBlocks: JobDetailBlock[], secondaryBlocks: JobDetailBlock[]): JobDetailBlock[] {
  return normalizeBlocks([...primaryBlocks, ...secondaryBlocks])
}

function normalizeBlocks(blocks: JobDetailBlock[]): JobDetailBlock[] {
  const normalized: JobDetailBlock[] = []
  for (const block of blocks) {
    if (block.type === 'list') {
      const items = dedupeStrings(block.items)
      if (!items.length) continue
      const previous = normalized[normalized.length - 1]
      if (previous?.type === 'list' && Boolean(previous.ordered) === Boolean(block.ordered)) {
        previous.items = dedupeStrings([...previous.items, ...items])
        continue
      }
      normalized.push({ type: 'list', items, ordered: block.ordered })
      continue
    }

    const text = String(block.text || '').trim()
    if (!text) continue
    const previous = normalized[normalized.length - 1]
    if (previous?.type === block.type && previous.type !== 'subheading') {
      previous.text = `${previous.text}\n\n${text}`.trim()
      continue
    }
    normalized.push({ ...block, text })
  }
  return normalized
}

function createEmptySection(
  canonicalTitle: JobDetailCanonicalTitle,
  source: ParsedSection['source'],
  orderHint: number,
  blocks: JobDetailBlock[] = []
): ParsedSection {
  return {
    canonicalTitle,
    rawTitle: undefined,
    displayTitle: CANONICAL_TITLES[canonicalTitle],
    blocks,
    source,
    orderHint
  }
}

function createTextBlock(text: string): JobDetailBlock {
  if (NOTE_PREFIX.test(text)) {
    return { type: 'note', text: text.replace(NOTE_PREFIX, '').trim() || text.trim() }
  }
  return { type: 'paragraph', text: text.trim() }
}

function extractListItem(line: string): { text: string; ordered: boolean } | null {
  const match = line.match(/^\s*(?:[-•*▪◦‣]|(\d+)[\.)])\s+(.+)$/)
  if (!match) return null
  return {
    ordered: Boolean(match[1]),
    text: match[2].trim()
  }
}

function detectHeading(line: string): { canonicalTitle: JobDetailCanonicalTitle; rawTitle?: string; displayTitle: string } | null {
  const normalizedHeading = normalizeHeadingText(line)
  if (!normalizedHeading) return null
  if (normalizedHeading.length > 80) return null
  if (/^[-•*▪◦‣]/.test(normalizedHeading)) return null
  if (/^[a-z].*[.!?。]$/.test(normalizedHeading)) return null

  for (const rule of STRONG_HEADING_RULES) {
    if (rule.patterns.some(pattern => pattern.test(normalizedHeading))) {
      return {
        canonicalTitle: rule.canonicalTitle,
        rawTitle: normalizedHeading,
        displayTitle: CANONICAL_TITLES[rule.canonicalTitle]
      }
    }
  }

  if (!looksLikeWeakHeading(normalizedHeading)) return null

  const inferredTitle = inferCanonicalTitle(normalizedHeading)
  return {
    canonicalTitle: inferredTitle,
    rawTitle: normalizedHeading,
    displayTitle: CANONICAL_TITLES[inferredTitle]
  }
}

function inferCanonicalTitle(rawTitle: string): JobDetailCanonicalTitle {
  const lower = rawTitle.toLowerCase()
  if (/(team)/i.test(lower) || /团队/.test(rawTitle)) return 'team'
  if (/(apply|process|next step|hiring)/i.test(lower) || /申请|流程/.test(rawTitle)) return 'apply'
  if (/(salary|compensation|pay)/i.test(lower) || /薪资/.test(rawTitle)) return 'compensation'
  if (/(company|about us|who we are)/i.test(lower) || /公司|我们/.test(rawTitle)) return 'company'
  return 'details'
}

function looksLikeWeakHeading(line: string): boolean {
  if (line.length < 2 || line.length > 60) return false
  if (/[,，;；]/.test(line)) return false
  if (/^\d+[\.)]/.test(line)) return false
  if (/^[-•*▪◦‣]/.test(line)) return false
  const endsWithColon = /[:：]$/.test(line)
  const isBoldHeading = /^\*\*.+\*\*$/.test(line)
  const isUppercase = /^[A-Z0-9\s/&+-]+$/.test(line) && /[A-Z]/.test(line)
  const isTitleCase = isTitleCaseHeading(line)
  const chineseShortTitle = /[\u4e00-\u9fa5]/.test(line)
    && line.length <= 12
    && /(职责|要求|福利|介绍|流程|加分|说明|概述|团队|公司)/.test(line)
  return endsWithColon || isBoldHeading || isUppercase || isTitleCase || chineseShortTitle
}

function isTitleCaseHeading(line: string): boolean {
  const words = line.replace(/[:：]$/, '').split(/\s+/).filter(Boolean)
  if (words.length === 0 || words.length > 8) return false
  const capitalizedWords = words.filter(word => /^[A-Z][A-Za-z'&/-]*$/.test(word) || /^[A-Z]{2,}$/.test(word)).length
  return capitalizedWords / words.length >= 0.7
}

function looksLikeStandaloneSubheading(line: string, section: ParsedSection): boolean {
  if (section.canonicalTitle === 'overview' && section.blocks.length === 0) return false
  if (!looksLikeWeakHeading(line)) return false
  const normalizedHeading = normalizeHeadingText(line)
  if (!normalizedHeading) return false
  const heading = detectHeading(normalizedHeading)
  return !heading || heading.canonicalTitle === section.canonicalTitle || heading.canonicalTitle === 'details'
}

function normalizeHeadingText(line: string): string {
  return String(line || '')
    .trim()
    .replace(/^#+\s*/, '')
    .replace(/^\*\*(.*?)\*\*[:：]?$/, '$1')
    .replace(/[:：]$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeDescription(text: string): string {
  const normalized = decodeHtmlEntities(String(text || ''))
    .replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/(p|div|section|article|h[1-6]|ul|ol|table|tr)>/gi, '\n')
    .replace(/<(p|div|section|article|h[1-6]|ul|ol|table|tr)[^>]*>/gi, '')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '$1')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u00A0\t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')

  return normalized
    .split('\n')
    .map(line => normalizeLine(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function joinParagraphLines(lines: string[]): string {
  return lines
    .map(line => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()
}

function normalizeLine(line: string): string {
  return String(line || '')
    .replace(/\s+/g, ' ')
    .replace(/^[-•▪◦‣]\s*/, '- ')
    .trim()
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function normalizeInputText(text?: string): string {
  return typeof text === 'string' ? text.trim() : ''
}

function toCleanLines(items?: string[]): string[] {
  if (!Array.isArray(items)) return []
  return dedupeStrings(
    items
      .map(item => sanitizeDescription(String(item || '')))
      .flatMap(item => item.split(/\n+/))
      .map(item => item.trim())
      .filter(Boolean)
  )
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  values.forEach(value => {
    const trimmed = String(value || '').trim()
    if (!trimmed) return
    const key = trimmed.toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:!?。，；：！?]/g, '')
    if (seen.has(key)) return
    seen.add(key)
    result.push(trimmed)
  })

  return result
}

function hasMeaningfulContent(blocks: JobDetailBlock[]): boolean {
  return blocks.some(block => {
    if (block.type === 'list') return block.items.length > 0
    return String(block.text || '').trim().length > 0
  })
}

function shouldUseTranslatedDescription(
  originalDescription: string,
  translatedDescription: string,
  originalSections: ParsedSection[]
): boolean {
  if (!translatedDescription) return false
  if (!originalDescription) return true
  if (originalDescription.length > 600 && translatedDescription.length < Math.min(240, originalDescription.length * 0.3)) {
    return false
  }

  const translatedSections = parseDescriptionSections(translatedDescription)
  if (!translatedSections.length) return false
  if (originalSections.length > 1 && translatedSections.length < Math.max(2, Math.floor(originalSections.length / 2))) {
    return false
  }
  return true
}
