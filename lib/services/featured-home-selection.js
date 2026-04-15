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

export function buildDailyFeaturedSelection(items = [], limit = 6) {
  const companyCounts = {}
  const dispersedItems = []

  for (const item of items) {
    if (dispersedItems.length >= Math.max(limit * 4, 24)) break

    const companyKey = item?.companyId || item?.company_id || item?.company
    if (!companyKey) continue

    const count = companyCounts[companyKey] || 0
    if (count >= 1) continue

    dispersedItems.push(item)
    companyCounts[companyKey] = count + 1
  }

  if (dispersedItems.length <= limit) {
    return dispersedItems.slice(0, limit)
  }

  const fixedItems = dispersedItems.slice(0, Math.min(2, limit))
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
