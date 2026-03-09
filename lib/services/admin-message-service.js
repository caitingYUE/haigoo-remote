import neonHelper from '../../server-utils/dal/neon-helper.js'

function normalizeMessageField(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

export async function createAdminMessage({ type = 'system_notice', title, content }) {
  if (!neonHelper.isConfigured) return false

  const normalizedTitle = normalizeMessageField(title)
  const normalizedContent = normalizeMessageField(content)
  if (!normalizedTitle || !normalizedContent) return false

  await neonHelper.query(
    'INSERT INTO admin_messages (type, title, content) VALUES ($1, $2, $3)',
    [type, normalizedTitle, normalizedContent]
  )

  return true
}

export async function createAdminMessageOnce({ type = 'system_notice', title, content }) {
  if (!neonHelper.isConfigured) return false

  const normalizedTitle = normalizeMessageField(title)
  const normalizedContent = normalizeMessageField(content)
  if (!normalizedTitle || !normalizedContent) return false

  const existing = await neonHelper.query(
    `SELECT id
     FROM admin_messages
     WHERE type = $1
       AND title = $2
       AND content = $3
     LIMIT 1`,
    [type, normalizedTitle, normalizedContent]
  )

  if (existing?.[0]) return false

  return createAdminMessage({
    type,
    title: normalizedTitle,
    content: normalizedContent
  })
}
