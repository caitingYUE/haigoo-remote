import React, { useState, useRef, useEffect } from 'react'
import { SUBSCRIPTION_TOPICS, MAX_SUBSCRIPTION_TOPICS } from '../constants/subscription-topics'
import { Check, ChevronDown, Info } from 'lucide-react'

type Variant = 'card' | 'compact' | 'minimal'

export default function JobAlertSubscribe({ variant = 'card', theme = 'dark' }: { variant?: Variant, theme?: 'light' | 'dark' }) {
  const [channel, setChannel] = useState<'email' | 'feishu'>('email')
  const [identifier, setIdentifier] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleTopic = (value: string) => {
    if (selectedTopics.includes(value)) {
      setSelectedTopics(selectedTopics.filter(t => t !== value))
    } else {
      if (selectedTopics.length >= MAX_SUBSCRIPTION_TOPICS) return
      setSelectedTopics([...selectedTopics, value])
    }
  }

  const submit = async () => {
    if (!identifier.trim()) return
    if (selectedTopics.length === 0) {
        // Default to all if nothing selected? Or require selection?
        // User request: "support multiple types... max 3".
        // Let's require at least one.
        alert('请至少选择一个岗位类型')
        return
    }
    
    setStatus('loading')
    try {
      const resp = await fetch('/api/auth?action=subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            channel, 
            identifier, 
            topic: selectedTopics.join(',') 
        })
      })
      const json = await resp.json()
      setStatus(json.success ? 'done' : 'error')
      if (json.success) {
          setTimeout(() => setStatus('idle'), 3000)
      }
    } catch {
      setStatus('error')
    }
  }

  const getButtonLabel = () => {
    if (selectedTopics.length === 0) return '选择岗位类型'
    if (selectedTopics.length === 1) {
        const t = SUBSCRIPTION_TOPICS.find(opt => opt.value === selectedTopics[0])
        return t ? t.label : selectedTopics[0]
    }
    return `已选 ${selectedTopics.length} 个类型`
  }

  const renderDropdown = (isDarkBg: boolean, className: string = "w-64") => (
    <div className={`absolute top-full left-0 z-50 mt-2 max-h-80 overflow-y-auto rounded-xl shadow-xl border p-2 ${isDarkBg ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} ${className}`}>
      <div className={`px-2 py-1.5 text-xs font-medium mb-1 ${isDarkBg ? 'text-slate-400' : 'text-slate-500'}`}>
        最多可选 {MAX_SUBSCRIPTION_TOPICS} 个
      </div>
      {SUBSCRIPTION_TOPICS.map(opt => {
        const isSelected = selectedTopics.includes(opt.value)
        return (
          <div 
            key={opt.value}
            onClick={() => toggleTopic(opt.value)}
            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors
                ${isSelected 
                    ? (isDarkBg ? 'bg-indigo-600/20 text-indigo-300' : 'bg-indigo-50 text-indigo-700') 
                    : (isDarkBg ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50')
                }
            `}
          >
            <span>{opt.label}</span>
            {isSelected && <Check className="w-3.5 h-3.5" />}
          </div>
        )
      })}
    </div>
  )

  const renderHint = () => (
      <div className="flex items-start gap-1.5 mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
              提示：最多可选{MAX_SUBSCRIPTION_TOPICS}个。上传简历可大幅提升推荐精准度，否则仅基于所选类型泛匹配。
          </span>
      </div>
  )

  if (variant === 'compact') {
    return (
      <div className="cta-inline relative" role="form" aria-label="订阅岗位推送">
        <div className="relative" ref={dropdownRef}>
            <button 
                className="cta-select mr-2 p-2 rounded border border-slate-300 text-sm flex items-center justify-between min-w-[120px] bg-white"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
                <span className="truncate max-w-[100px]">{getButtonLabel()}</span>
                <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
            </button>
            {isDropdownOpen && renderDropdown(false)}
        </div>
        
        <input className="cta-input" placeholder="输入邮箱即可订阅" value={identifier} onChange={e => setIdentifier(e.target.value)} />
        <button onClick={submit} className="cta-btn">订阅</button>
        {status === 'done' && <span className="text-green-600 text-xs ml-2">已订阅</span>}
        {status === 'error' && <span className="text-red-600 text-xs ml-2">失败</span>}
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

        <div className="flex flex-col sm:flex-row gap-3 relative z-20">
           <div className="relative w-full sm:w-40" ref={dropdownRef}>
              <button
                className={`w-full px-4 py-3 rounded-xl border focus:outline-none transition-colors backdrop-blur-sm flex items-center justify-between text-left
                    ${isLight
                    ? 'bg-white border-slate-200 text-slate-900 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100'
                    : 'bg-white/10 border-white/20 text-white focus:bg-white/20'}
                `}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span className="truncate text-sm">{getButtonLabel()}</span>
                <ChevronDown className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-white/60'}`} />
              </button>
              {isDropdownOpen && renderDropdown(!isLight, "w-full sm:w-64")}
           </div>

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
        {/* Hint Text */}
        <div className={`text-xs text-center sm:text-left ${isLight ? 'text-slate-500' : 'text-white/70'} mt-1 flex items-center justify-center sm:justify-start gap-1`}>
             <Info className="w-3 h-3" />
             <span>最多选3个。上传简历可大幅提升推荐精准度。</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border p-5 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-slate-900">订阅岗位提醒</div>
      </div>
      
      <div className="space-y-3">
          <div className="relative" ref={dropdownRef}>
              <button 
                  className="w-full px-3 py-2 border rounded-lg text-sm flex items-center justify-between hover:border-indigo-500 transition-colors"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                  <span className="text-slate-700">{getButtonLabel()}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              {isDropdownOpen && renderDropdown(false)}
          </div>

          <div className="flex gap-2">
            <select className="input w-24 px-2 py-2 border rounded-lg text-sm bg-slate-50" value={channel} onChange={e => setChannel(e.target.value as any)}>
              <option value="email">Email</option>
              <option value="feishu">飞书</option>
            </select>
            <input className="input flex-1 px-3 py-2 border rounded-lg text-sm" placeholder={channel === 'email' ? 'you@example.com' : 'Feishu ID'} value={identifier} onChange={e => setIdentifier(e.target.value)} />
          </div>
          
          <button onClick={submit} className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm">
              {status === 'loading' ? '提交中...' : '立即订阅'}
          </button>
      </div>

      {renderHint()}
      
      {status === 'done' && <div className="mt-3 text-green-600 text-sm font-medium text-center">订阅成功！</div>}
      {status === 'error' && <div className="mt-3 text-red-600 text-sm font-medium text-center">订阅失败，请重试</div>}
    </div>
  )
}
