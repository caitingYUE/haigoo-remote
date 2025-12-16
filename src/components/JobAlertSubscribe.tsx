import React, { useState } from 'react'

type Variant = 'card' | 'compact' | 'minimal'

const TOPIC_OPTIONS = [
  { value: 'all', label: '全部岗位' },
  { value: 'development', label: '技术开发' },
  { value: 'product', label: '产品设计' },
  { value: 'operations', label: '运营市场' },
  { value: 'data', label: '数据分析' },
  { value: 'function', label: '职能支持' },
  { value: 'ops_qa', label: '运维测试' },
]

export default function JobAlertSubscribe({ variant = 'card', theme = 'dark' }: { variant?: Variant, theme?: 'light' | 'dark' }) {
  const [channel, setChannel] = useState<'email' | 'feishu'>('email')
  const [identifier, setIdentifier] = useState('')
  const [topic, setTopic] = useState('all')
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
        <select 
          className="cta-select mr-2 p-2 rounded border border-slate-300 text-sm" 
          value={topic} 
          onChange={e => setTopic(e.target.value)}
        >
           {TOPIC_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
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
              ? (isLight ? 'text-indigo-600' : 'text-white')
              : (isLight ? 'text-slate-400 hover:text-slate-600' : 'text-white/60 hover:text-white')}`}
          >
            Email 订阅
          </button>
          <div className={`w-px h-4 ${isLight ? 'bg-slate-300' : 'bg-white/20'}`}></div>
          <button
            onClick={() => setChannel('feishu')}
            className={`text-sm font-medium transition-colors ${channel === 'feishu'
              ? (isLight ? 'text-indigo-600' : 'text-white')
              : (isLight ? 'text-slate-400 hover:text-slate-600' : 'text-white/60 hover:text-white')}`}
          >
            飞书订阅
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 relative">
           <select
            className={`w-full sm:w-32 px-4 py-3 rounded-xl border focus:outline-none transition-colors backdrop-blur-sm appearance-none cursor-pointer
                ${isLight
                ? 'bg-white border-slate-200 text-slate-900 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100'
                : 'bg-white/10 border-white/20 text-white focus:bg-white/20'}
            `}
            value={topic}
            onChange={e => setTopic(e.target.value)}
            style={{ backgroundImage: 'none' }} // Hide default arrow if needed, but standard select is safer
          >
            {TOPIC_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value} className="text-slate-900">
                    {opt.label}
                </option>
            ))}
          </select>

          <input
            className={`flex-1 px-4 py-3 rounded-xl border focus:outline-none transition-colors backdrop-blur-sm
                ${isLight
                ? 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100'
                : 'bg-white/10 border-white/20 text-white placeholder-indigo-200 focus:bg-white/20'}`}
            placeholder={channel === 'email' ? "输入您的邮箱地址" : "输入您的飞书 ID"}
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
          />
          <button
            onClick={submit}
            className={`px-6 py-3 font-bold rounded-xl transition-colors shadow-lg whitespace-nowrap
                ${isLight
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                : 'bg-white text-indigo-600 hover:bg-indigo-50 shadow-indigo-900/20'}`}
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
        <div className="font-semibold">订阅岗位提醒</div>
        <select className="input w-40 px-2 py-1 border rounded" value={topic} onChange={e => setTopic(e.target.value)}>
          {TOPIC_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div className="mt-3 flex gap-2">
        <select className="input w-32 px-2 py-1 border rounded" value={channel} onChange={e => setChannel(e.target.value as any)}>
          <option value="email">Email</option>
          <option value="feishu">飞书</option>
        </select>
        <input className="input flex-1 px-2 py-1 border rounded" placeholder={channel === 'email' ? 'you@example.com' : 'Feishu ID'} value={identifier} onChange={e => setIdentifier(e.target.value)} />
        <button onClick={submit} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">订阅</button>
      </div>
      {status === 'done' && <div className="mt-2 text-green-600 text-sm">订阅成功</div>}
      {status === 'error' && <div className="mt-2 text-red-600 text-sm">订阅失败</div>}
    </div>
  )
}
