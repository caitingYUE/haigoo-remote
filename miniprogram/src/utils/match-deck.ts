export function resolveDeckRelease(offsetX: number, cardWidth: number, velocityX = 0): -1 | 0 | 1 {
  if (!Number.isFinite(offsetX) || !Number.isFinite(cardWidth) || cardWidth <= 0) return 0
  const passedDistance = Math.abs(offsetX) >= cardWidth * 0.08
  const passedVelocity = Math.abs(offsetX) >= 18 && Math.abs(velocityX) >= 0.22
  if (!passedDistance && !passedVelocity) return 0
  return offsetX < 0 ? 1 : -1
}

export function wrapDeckIndex(index: number, length: number) {
  return length > 0 ? (index % length + length) % length : 0
}

export function matchDeckStorageKey(userId: string, snapshotId: string) {
  return `haigoo:match-deck:${userId || 'guest'}:${snapshotId || 'current'}`
}
