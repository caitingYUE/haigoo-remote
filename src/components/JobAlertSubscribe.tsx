import React, { useState } from 'react'

type Variant = 'card' | 'compact' | 'minimal'

export default function JobAlertSubscribe({ variant = 'card', theme = 'dark' }: { variant?: Variant, theme?: 'light' | 'dark' }) {
  const [channel, setChannel] = useState<'email' | 'feishu'>('email')
  const [identifier, setIdentifier] = useState('')
  const [topic, setTopic] = useState('product')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

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

  if (variant === 'compact') {
    return (
      <div className="cta-inline" role="form" aria-label="订阅岗位推送">
        <input className="cta-input" placeholder="输入邮箱即可订阅" value={identifier} onChange={e => setIdentifier(e.target.value)} />
        <button onClick={submit} className="cta-btn">订阅</button>
        {status === 'done' && <span className="text-green-600 text-xs">已订阅</span>}
        {status === 'error' && <span className="text-red-600 text-xs">失败</span>}
      </div>
    )
  }

  if (variant === 'minimal') {
    const isLight = theme === 'light'

    return (
      <div className="flex flex-col gap-3">
        {/* Channel Selector */}
        <div className="flex justify-center gap-4 mb-1">
          <button
            onClick={() => setChannel('email')}
            className={`text-sm font-medium transition-colors ${channel === 'email'
              ? (isLight ? 'text-blue-600' : 'text-white')
              : (isLight ? 'text-gray-400 hover:text-gray-600' : 'text-white/60 hover:text-white')}`}
          >
            Email 订阅
          </button>
          <div className={`w-px h-4 ${isLight ? 'bg-gray-300' : 'bg-white/20'}`}></div>
          <button
            onClick={() => setChannel('feishu')}
            className={`text-sm font-medium transition-colors ${channel === 'feishu'
              ? (isLight ? 'text-blue-600' : 'text-white')
              : (isLight ? 'text-gray-400 hover:text-gray-600' : 'text-white/60 hover:text-white')}`}
          >
            飞书订阅
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 relative">
          <input
            className={`flex-1 px-4 py-3 rounded-xl border focus:outline-none transition-colors backdrop-blur-sm
                ${isLight
                ? 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
                : 'bg-white/10 border-white/20 text-white placeholder-blue-200 focus:bg-white/20'}`}
            placeholder={channel === 'email' ? "输入您的邮箱地址" : "输入您的飞书 ID"}
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
          />
          <button
            onClick={submit}
            className={`px-6 py-3 font-bold rounded-xl transition-colors shadow-lg 
                ${isLight
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
                : 'bg-white text-blue-600 hover:bg-blue-50 shadow-blue-900/20'}`}
          >
            立即订阅
          </button>
          {status === 'done' && <div className={`absolute -bottom-8 left-0 text-sm font-medium ${isLight ? 'text-green-600' : 'text-white'}`}>订阅成功！</div>}
          {status === 'error' && <div className={`absolute -bottom-8 left-0 text-sm font-medium ${isLight ? 'text-red-600' : 'text-red-100'}`}>订阅失败，请重试</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border p-5 bg-white">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Get Job Alerts</div>
        <select className="input w-40" value={topic} onChange={e => setTopic(e.target.value)}>
          {['product', 'development', 'algorithm', 'operations', 'marketing', 'account', 'support'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="mt-3 flex gap-2">
        <select className="input w-32" value={channel} onChange={e => setChannel(e.target.value as any)}>
          <option value="email">Email</option>
          <option value="feishu">Feishu</option>
        </select>
        <input className="input" placeholder={channel === 'email' ? 'you@example.com' : 'Feishu ID'} value={identifier} onChange={e => setIdentifier(e.target.value)} />
        <button onClick={submit} className="px-4 py-2 bg-[#3182CE] text-white rounded-lg hover:bg-[#256bb0] transition-colors">Subscribe</button>
      </div>
      {status === 'done' && <div className="mt-2 text-green-600 text-sm">Subscribed successfully</div>}
      {status === 'error' && <div className="mt-2 text-red-600 text-sm">Subscription failed</div>}
    </div>
  )
}