const GUEST_RESUME_STORAGE_KEY = 'copilot_guest_resume_pending_v1'
const GUEST_RESUME_LINK_TTL = 5 * 60 * 1000

type PendingGuestResume = {
  fileName: string
  fileType: string
  fileSize: number
  dataBase64: string
  resumeHints: string[]
  savedAt: number
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

function dataURLToFile(dataURL: string, fileName: string, fileType = 'application/octet-stream') {
  const [, base64 = ''] = dataURL.split(',')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new File([bytes], fileName, { type: fileType })
}

export function readPendingGuestResume(): PendingGuestResume | null {
  try {
    const raw = localStorage.getItem(GUEST_RESUME_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingGuestResume
    if (!parsed?.savedAt || !parsed?.dataBase64) return null
    if (Date.now() - parsed.savedAt > GUEST_RESUME_LINK_TTL) {
      localStorage.removeItem(GUEST_RESUME_STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export async function savePendingGuestResume(file: File, resumeHints: string[] = []) {
  const dataUrl = await readAsDataURL(file)
  const payload: PendingGuestResume = {
    fileName: file.name,
    fileType: file.type || 'application/octet-stream',
    fileSize: file.size,
    dataBase64: dataUrl,
    resumeHints: Array.isArray(resumeHints) ? resumeHints.slice(0, 24) : [],
    savedAt: Date.now(),
  }
  localStorage.setItem(GUEST_RESUME_STORAGE_KEY, JSON.stringify(payload))
}

export function clearPendingGuestResume() {
  localStorage.removeItem(GUEST_RESUME_STORAGE_KEY)
}

export function hydrateGuestResumeFile(pending: PendingGuestResume | null): File | null {
  if (!pending?.dataBase64 || !pending.fileName) return null
  try {
    return dataURLToFile(pending.dataBase64, pending.fileName, pending.fileType)
  } catch {
    return null
  }
}

export async function claimPendingGuestResume(token: string): Promise<{ claimed: boolean; resumeId?: string }> {
  const pending = readPendingGuestResume()
  if (!pending || !token) return { claimed: false }

  const file = hydrateGuestResumeFile(pending)
  if (!file) {
    clearPendingGuestResume()
    return { claimed: false }
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('metadata', JSON.stringify({
    source: 'copilot',
    module: 'copilot',
    from: 'guest_home_hero',
    linkedWithinMinutes: Math.floor((Date.now() - pending.savedAt) / 60000),
  }))

  const resp = await fetch('/api/resumes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  const result = await resp.json().catch(() => ({}))
  if (!resp.ok || !result?.success) {
    return { claimed: false }
  }
  clearPendingGuestResume()
  return { claimed: true, resumeId: result.id }
}

export { GUEST_RESUME_LINK_TTL }
