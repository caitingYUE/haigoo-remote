const GOOGLE_IDENTITY_SCRIPT_ID = 'google-identity-services'
const GOOGLE_IDENTITY_SRC = 'https://accounts.google.com/gsi/client'

export function loadGoogleIdentity(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.accounts?.id) return Promise.resolve()

  const existing = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID) as HTMLScriptElement | null
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Google Identity Services failed to load')), { once: true })
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = GOOGLE_IDENTITY_SCRIPT_ID
    script.src = GOOGLE_IDENTITY_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Identity Services failed to load'))
    document.head.appendChild(script)
  })
}
