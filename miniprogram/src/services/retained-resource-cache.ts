// Session memory only. Content keys include account/entitlement scope in the hook.
export const retainedResources = new Map<string, { data: unknown; loadedAt: number }>()
const revisions = new Map<string, number>()

export function resourceRevision(key: string) {
  return [...revisions].reduce((total, [prefix, revision]) => total + (key.startsWith(prefix) ? revision : 0), 0)
}

export function invalidateMiniResource(prefix: string) {
  revisions.set(prefix, (revisions.get(prefix) || 0) + 1)
  for (const key of retainedResources.keys()) {
    if (key.slice(key.indexOf('\n') + 1).startsWith(prefix)) retainedResources.delete(key)
  }
}
