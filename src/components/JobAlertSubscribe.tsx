import React, { useState } from 'react'

export default function JobAlertSubscribe() {
  const [channel, setChannel] = useState<'email'|'feishu'>('email')
  const [identifier, setIdentifier] = useState('')
  const [topic, setTopic] = useState('product')
  const [status, setStatus] = useState<'idle'|'loading'|'done'|'error'>('idle')

  const submit = async () => {
    if (!identifier.trim()) return
    setStatus('loading')
    try {
      const resp = await fetch('/api/auth?action=subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, identifier, topic })
      })
      const json = await resp.json()
      setStatus(json.success ? 'done' : 'error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="rounded-2xl border p-5 bg-white">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Get Job Alerts</div>
        <select className="input w-40" value={topic} onChange={e=>setTopic(e.target.value)}>
          {['product','development','algorithm','operations','marketing','account','support'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="mt-3 flex gap-2">
        <select className="input w-32" value={channel} onChange={e=>setChannel(e.target.value as any)}>
          <option value="email">Email</option>
          <option value="feishu">Feishu</option>
        </select>
        <input className="input" placeholder={channel==='email' ? 'you@example.com' : 'Feishu ID'} value={identifier} onChange={e=>setIdentifier(e.target.value)} />
        <button onClick={submit} className="btn btn-primary">Subscribe</button>
      </div>
      {status==='done' && <div className="mt-2 text-green-600 text-sm">Subscribed successfully</div>}
      {status==='error' && <div className="mt-2 text-red-600 text-sm">Subscription failed</div>}
    </div>
  )
}