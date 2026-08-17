import { useEffect, useState } from 'react'

export default function MiniWebEntryPage() {
  const [message, setMessage] = useState('正在打开申请机会…')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ticket = params.get('ticket') || ''
    const job = params.get('job') || ''
    if (!ticket || !job) {
      setMessage('申请入口无效，请返回小程序重试。')
      return
    }
    void fetch('/api/mini-web-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket, job })
    }).then(async (response) => {
      const data = await response.json()
      if (!response.ok || !data?.token || !data?.destination) throw new Error(data?.error || '申请入口暂不可用')
      localStorage.setItem('haigoo_auth_token', data.token)
      localStorage.setItem('haigoo_user', JSON.stringify(data.user || {}))
      localStorage.setItem('haigoo_login_event_at', String(Date.now()))
      window.location.replace(data.destination)
    }).catch((error) => setMessage(error instanceof Error ? error.message : '申请入口暂不可用'))
  }, [])

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#F6F7FA', color: '#182033' }}>
      <div style={{ maxWidth: 360, textAlign: 'center' }}>
        <div style={{ width: 40, height: 4, margin: '0 auto 24px', background: '#E96832' }} />
        <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.4 }}>Haigoo Remote</h1>
        <p style={{ marginTop: 12, color: '#667085', fontSize: 16, lineHeight: 1.7 }}>{message}</p>
      </div>
    </main>
  )
}
