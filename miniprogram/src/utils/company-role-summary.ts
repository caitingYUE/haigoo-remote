import type { WatchFilterOptions, WatchProfile } from '../services/career-match-service'
import { normalizeOpenRoleCategories } from '../../../lib/shared/mini-company-presentation'

export interface CompanyRoleSegment {
  label: string
  matched: boolean
}

export interface CompanyRoleSummary {
  ariaLabel: string
  segments: CompanyRoleSegment[]
  suffix: string
}

export function buildCompanyRoleSummary(
  categories: string[] = [],
  profile: WatchProfile | null,
  filterOptions: WatchFilterOptions
): CompanyRoleSummary {
  const normalized = normalizeOpenRoleCategories(categories, categories.length)
  if (!normalized.length) {
    return { ariaLabel: '岗位类型待补充', segments: [], suffix: '岗位类型待补充' }
  }

  const optionMap = new Map((filterOptions.roleGroups || []).flatMap((group) => group.options)
    .map((option) => [option.value, option]))
  const exact = new Set((profile?.customRoleTerms || [])
    .map((item) => item.trim())
    .filter(Boolean))
  const hasSpecificSelection = Array.from(exact).some((item) => optionMap.has(item) || normalized.includes(item))
  const families = new Set(profile?.roleFamilies || [])
  const segments = normalized.map((label) => {
    const option = optionMap.get(label)
    return {
      label,
      matched: exact.has(label) || (!hasSpecificSelection && Boolean(option?.families.some((family) => families.has(family))))
    }
  })
  // Stable partition: matching directions lead; source order stays intact
  // within each group. Truncation belongs to layout, after personalization.
  const ordered = segments.filter((item) => item.matched).concat(segments.filter((item) => !item.matched))
  // Keep the compact card copy deterministic. CSS-only truncation can detach
  // a leading delimiter from its role name in WeChat text layout.
  const visible = ordered.slice(0, 2)
  const suffix = visible.length > 1 ? '等方向可关注' : '方向可关注'

  return { ariaLabel: `${visible.map((item) => item.label).join('、')}${suffix}`, segments: visible, suffix }
}
