const GENERIC_CATEGORY_CHILDREN = new Map([
  ['软件开发', new Set(['后端开发', '前端开发', '全栈开发', '移动开发', '数据开发', '服务器开发', '平台工程师', '数据库工程师'])],
  ['设计', new Set(['产品设计', 'UI/UX设计', '视觉设计', '平面设计', '创意设计', '营销设计', '品牌设计'])]
])

function cleanText(value, limit = 160) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

export function maskCompanyContactName(value) {
  const name = cleanText(value, 100)
  if (!name) return '联系人'
  if (/^[\u3400-\u9fff]+$/u.test(name)) {
    return name.length === 1 ? name : `${name[0]}${'*'.repeat(name.length - 1)}`
  }
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.length === 1 ? part : `${part[0]}***`)
    .join(' ')
}

export function buildCompanyContactPreview(contact = {}) {
  return {
    id: cleanText(contact.id, 120) || 'contact',
    maskedName: maskCompanyContactName(contact.name),
    title: cleanText(contact.title, 160)
  }
}

export function normalizeOpenRoleCategories(values, limit = 6) {
  const unique = Array.from(new Set((Array.isArray(values) ? values : [])
    .filter((value) => typeof value === 'string')
    .map((value) => cleanText(value, 120))
    .filter((value) => value && !/^(其他|未知|未分类|unknown|uncategorized)$/i.test(value))))
  const present = new Set(unique)
  const specific = unique.filter((value) => {
    const children = GENERIC_CATEGORY_CHILDREN.get(value)
    return !children || !Array.from(children).some((child) => present.has(child))
  })
  const safeLimit = Math.max(0, Math.min(unique.length, Number(limit) || 0))
  return specific.slice(0, safeLimit)
}
