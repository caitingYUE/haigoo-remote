export function getShanghaiDateKey() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date())
  } catch (_error) {
    return new Date().toISOString().slice(0, 10)
  }
}

export function getSeedFromString(value = '') {
  return Array.from(String(value)).reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

export function buildDailyFeaturedSelection(items = [], limit = 6, options = {}) {
  const pinnedItems = Array.isArray(options.pinnedItems) ? options.pinnedItems : []
  const pinnedLimit = Math.max(0, Math.min(Number.parseInt(options.pinnedLimit, 10) || 0, limit))
  const companyCounts = {}
  const dispersedItems = []
  const acceptedIds = new Set()

  const acceptItem = (item) => {
    const jobKey = item?.job_id || item?.jobId || item?.id
    if (!jobKey || acceptedIds.has(String(jobKey))) return false

    const companyKey = item?.companyId || item?.company_id || item?.company
    if (!companyKey) return false

    const count = companyCounts[companyKey] || 0
    if (count >= 1) return false

    dispersedItems.push(item)
    acceptedIds.add(String(jobKey))
    companyCounts[companyKey] = count + 1
    return true
  }

  if (pinnedLimit > 0) {
    for (const item of pinnedItems) {
      if (dispersedItems.length >= pinnedLimit) break
      acceptItem(item)
    }
  }

  for (const item of items) {
    if (dispersedItems.length >= Math.max(limit * 4, 24)) break
    acceptItem(item)
  }

  if (dispersedItems.length <= limit) {
    return dispersedItems.slice(0, limit)
  }

  const fixedItems = dispersedItems.slice(0, Math.min(pinnedLimit, limit))
  const remainingSlots = Math.max(limit - fixedItems.length, 0)
  if (remainingSlots === 0) return fixedItems

  const rotatingPool = dispersedItems.slice(fixedItems.length, Math.min(dispersedItems.length, fixedItems.length + 12))
  if (rotatingPool.length <= remainingSlots) {
    return [...fixedItems, ...rotatingPool].slice(0, limit)
  }

  const seed = getSeedFromString(getShanghaiDateKey())
  const offset = seed % rotatingPool.length
  const rotatedItems = []

  for (let index = 0; index < rotatingPool.length; index += 1) {
    rotatedItems.push(rotatingPool[(offset + index) % rotatingPool.length])
    if (rotatedItems.length >= remainingSlots) break
  }

  return [...fixedItems, ...rotatedItems].slice(0, limit)
}
