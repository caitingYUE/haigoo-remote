import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { SUBSCRIPTION_TOPICS, MAX_SUBSCRIPTION_TOPICS } from '../constants/subscription-topics'
import { Check, ChevronDown, Info, ArrowRight } from 'lucide-react'

type Variant = 'card' | 'compact' | 'minimal'

export default function JobAlertSubscribe({ variant = 'card', theme = 'dark' }: { variant?: Variant, theme?: 'light' | 'dark' }) {
  const navigate = useNavigate()
  const { isAuthenticated, token } = useAuth()
  const [channel, setChannel] = useState<'email' | 'feishu'>('feishu')
  const [identifier, setIdentifier] = useState('')
  const [feishuNickname, setFeishuNickname] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [hasSubscription, setHasSubscription] = useState(false)
  const [checkingSubscription, setCheckingSubscription] = useState(false)

  useEffect(() => {
    if (isAuthenticated && token) {
      setCheckingSubscription(true)
      fetch('/api/auth?action=get-subscriptions', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.subscriptions && data.subscriptions.length > 0) {
          setHasSubscription(true)
        }
      })
      .catch(err => console.error('Check subscription failed', err))
      .finally(() => setCheckingSubscription(false))
    }
  }, [isAuthenticated, token])

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
    if (channel === 'email' && selectedTopics.length === 0) {
        alert('请至少选择一个岗位类型')
        return
    }
    if (channel === 'feishu' && (!identifier.trim() || !feishuNickname.trim())) {
        alert('请输入飞书手机号和昵称')
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
            nickname: channel === 'feishu' ? feishuNickname : undefined,
            topic: channel === 'email' ? selectedTopics.join(',') : undefined
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
    return null
  }

  const removeTopic = (e: React.MouseEvent, topicValue: string) => {
      e.stopPropagation();
      toggleTopic(topicValue);
  }

  const renderDropdown = (isDarkBg: boolean, className: string = "w-64") => (
    <div className={`absolute top-full left-0 z-50 mt-2 p-3 rounded-xl shadow-xl border ${isDarkBg ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} ${className}`}>
      <div className={`flex justify-between items-center mb-2 px-1`}>
        <span className={`text-xs font-medium ${isDarkBg ? 'text-slate-400' : 'text-slate-500'}`}>
          最多可选 {MAX_SUBSCRIPTION_TOPICS} 个
        </span>
        {selectedTopics.length > 0 && (
            <span 
                onClick={(e) => { e.stopPropagation(); setSelectedTopics([]); }}
                className="text-xs text-indigo-500 hover:text-indigo-600 cursor-pointer"
            >
                清空
            </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto custom-scrollbar">
        {SUBSCRIPTION_TOPICS.map(opt => {
            const isSelected = selectedTopics.includes(opt.value)
            return (
            <div 
                key={opt.value}
                onClick={() => toggleTopic(opt.value)}
                className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm cursor-pointer transition-all border
                    ${isSelected 
                        ? (isDarkBg ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-indigo-50 text-indigo-600 border-indigo-200 font-medium') 
                        : (isDarkBg ? 'bg-slate-700 text-slate-300 border-slate-600 hover:border-slate-500' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:bg-slate-50')
                    }
                `}
            >
                {opt.label}
            </div>
            )
        })}
      </div>
    </div>
  )

  const renderTriggerContent = (isLight: boolean) => {
      if (selectedTopics.length === 0) {
          return <span className={isLight ? 'text-slate-400' : 'text-white/60'}>选择岗位类型</span>
      }
      return (
          <div className="flex flex-wrap gap-1.5 overflow-hidden max-h-[28px]">
              {selectedTopics.map(t => {
                  const label = SUBSCRIPTION_TOPICS.find(opt => opt.value === t)?.label || t
                  return (
                      <span key={t} className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium z-10 ${isLight ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-white/20 text-white border border-white/20'}`}>
                          {label}
                          <span 
                            onClick={(e) => removeTopic(e, t)}
                            className={`ml-1 hover:text-red-400 cursor-pointer p-0.5 rounded-full hover:bg-black/5`}
                          >
                              ×
                          </span>
                      </span>
                  )
              })}
              {selectedTopics.length > 2 && <span className="text-xs opacity-50 self-center">...</span>}
          </div>
      )
  }

  const renderHint = () => {
      if (channel === 'feishu') {
          return (
            <div className="flex items-start gap-1.5 mt-2 text-xs text-indigo-600 bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                    提示：我们需要添加您的飞书账号来实现机器人订阅，请留意短信通知。
                </span>
            </div>
          )
      }
      return (
        <div className="flex items-start gap-1.5 mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
                提示：最多可选{MAX_SUBSCRIPTION_TOPICS}个。上传简历可大幅提升推荐精准度，否则仅基于所选类型泛匹配。
            </span>
        </div>
      )
  }

  if (variant === 'compact') {
    return (
      <div className="cta-inline relative" role="form" aria-label="订阅岗位推送">
        <div className="relative" ref={dropdownRef}>
            <button 
                className="cta-select mr-2 p-2 rounded border border-slate-300 text-sm flex items-center justify-between min-w-[120px] bg-white"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
                <div className="truncate max-w-[150px] flex items-center">{renderTriggerContent(true)}</div>
                <ChevronDown className="w-3 h-3 ml-1 opacity-50 flex-shrink-0" />
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

    if (hasSubscription) {
        return (
            <div className="flex flex-col items-center justify-center gap-6 py-2">
                <div className={`text-lg font-medium flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-white'}`}>
                    <Check className="w-5 h-5 text-green-500" />
                    您已订阅岗位提醒，可前往个人中心管理
                </div>
                <button
                    onClick={() => navigate('/profile?tab=subscriptions')}
                    className={`px-8 py-3 font-bold rounded-xl transition-colors shadow-lg flex items-center gap-2
                        ${isLight
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                        : 'bg-white text-indigo-600 hover:bg-indigo-50 shadow-indigo-900/20'}`}
                >
                    管理我的订阅
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        )
    }

    return (
      <div className="flex flex-col gap-3">
        {/* Channel Selector */}
        <div className="flex justify-center gap-4 mb-1">
          <button
            onClick={() => setChannel('feishu')}
            className={`text-sm font-medium transition-colors ${channel === 'feishu'
              ? (isLight ? 'text-indigo-600' : 'text-white')
              : (isLight ? 'text-slate-400 hover:text-slate-600' : 'text-white/60 hover:text-white')}`}
          >
            飞书订阅
          </button>
          <div className={`w-px h-4 ${isLight ? 'bg-slate-300' : 'bg-white/20'}`}></div>
          <button
            onClick={() => setChannel('email')}
            className={`text-sm font-medium transition-colors ${channel === 'email'
              ? (isLight ? 'text-indigo-600' : 'text-white')
              : (isLight ? 'text-slate-400 hover:text-slate-600' : 'text-white/60 hover:text-white')}`}
          >
            Email 订阅
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 relative z-20">
           {channel === 'email' && (
             <div className="relative w-full sm:w-40" ref={dropdownRef}>
                <button
                  className={`w-full px-4 py-3 rounded-xl border focus:outline-none transition-colors backdrop-blur-sm flex items-center justify-between text-left
                      ${isLight
                      ? 'bg-white border-slate-200 text-slate-900 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100'
                      : 'bg-white/10 border-white/20 text-white focus:bg-white/20'}
                  `}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <div className="truncate flex-1 flex items-center mr-2">{renderTriggerContent(isLight)}</div>
                  <ChevronDown className={`w-4 h-4 flex-shrink-0 ${isLight ? 'text-slate-400' : 'text-white/60'}`} />
                </button>
                {isDropdownOpen && renderDropdown(!isLight, "w-full sm:w-64")}
             </div>
           )}

          {channel === 'feishu' && (
            <input
              className={`w-full sm:w-40 px-4 py-3 rounded-xl border focus:outline-none transition-colors backdrop-blur-sm
                  ${isLight
                  ? 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100'
                  : 'bg-white/10 border-white/20 text-white placeholder-indigo-200 focus:bg-white/20'}`}
              placeholder="飞书昵称"
              value={feishuNickname}
              onChange={e => setFeishuNickname(e.target.value)}
            />
          )}

          <input
            className={`flex-1 px-4 py-3 rounded-xl border focus:outline-none transition-colors backdrop-blur-sm
                ${isLight
                ? 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100'
                : 'bg-white/10 border-white/20 text-white placeholder-indigo-200 focus:bg-white/20'}`}
            placeholder={channel === 'email' ? "输入您的邮箱地址" : "输入飞书绑定的手机号"}
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
          />
          <button
            onClick={submit}
            disabled={status === 'loading' || status === 'done'}
            className={`px-6 py-3 font-bold rounded-xl transition-all shadow-lg whitespace-nowrap flex items-center justify-center gap-2 min-w-[120px]
                ${status === 'done' 
                    ? (isLight ? 'bg-green-500 text-white shadow-green-200' : 'bg-green-500 text-white shadow-green-900/20')
                    : (isLight
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                        : 'bg-white text-indigo-600 hover:bg-indigo-50 shadow-indigo-900/20')
                }`}
          >
            {status === 'loading' && <span className="animate-spin">⏳</span>}
            {status === 'done' ? (
                <>
                    <Check className="w-5 h-5" />
                    <span>订阅成功</span>
                </>
            ) : (
                '立即订阅'
            )}
          </button>
        </div>
        {/* Hint Text */}
        <div className={`text-xs text-center sm:text-left ${isLight ? 'text-slate-500' : 'text-white/70'} mt-1 flex items-center justify-center sm:justify-start gap-1`}>
             <Info className="w-3 h-3" />
             <span>{channel === 'feishu' ? '我们需要添加您的飞书账号来实现机器人订阅，请留意短信通知。' : '最多选3个。上传简历可大幅提升推荐精准度。'}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border p-5 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-slate-900">订阅岗位提醒</div>
      </div>
      
      {hasSubscription ? (
        <div className="text-center py-4">
            <div className="flex justify-center mb-2">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="w-5 h-5 text-green-600" />
                </div>
            </div>
            <div className="text-slate-900 font-medium mb-1">您已订阅</div>
            <p className="text-xs text-slate-500 mb-4">不错过任何好机会</p>
            <button 
                onClick={() => navigate('/profile?tab=subscriptions')} 
                className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors font-medium text-sm"
            >
                管理我的订阅
            </button>
        </div>
      ) : (
        <>
            <div className="space-y-3">
                {channel === 'email' && (
                    <div className="relative" ref={dropdownRef}>
                        <button 
                            className="w-full px-3 py-2 border rounded-lg text-sm flex items-center justify-between hover:border-indigo-500 transition-colors"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        >
                            <div className="flex-1 flex items-center mr-2">{renderTriggerContent(true)}</div>
                            <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        </button>
                        {isDropdownOpen && renderDropdown(false)}
                    </div>
                )}

                <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <select className="input w-24 px-2 py-2 border rounded-lg text-sm bg-slate-50" value={channel} onChange={e => setChannel(e.target.value as any)}>
                            <option value="feishu">飞书</option>
                            <option value="email">Email</option>
                        </select>
                        <input 
                            className="input flex-1 px-3 py-2 border rounded-lg text-sm" 
                            placeholder={channel === 'email' ? 'you@example.com' : '飞书绑定手机号'} 
                            value={identifier} 
                            onChange={e => setIdentifier(e.target.value)} 
                        />
                    </div>
                    {channel === 'feishu' && (
                        <input 
                            className="input w-full px-3 py-2 border rounded-lg text-sm" 
                            placeholder="飞书昵称" 
                            value={feishuNickname} 
                            onChange={e => setFeishuNickname(e.target.value)} 
                        />
                    )}
                </div>
                
                <button onClick={submit} className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm">
                    {status === 'loading' ? '提交中...' : '立即订阅'}
                </button>
            </div>

            {renderHint()}
            
            {status === 'done' && <div className="mt-3 text-green-600 text-sm font-medium text-center">订阅成功！</div>}
            {status === 'error' && <div className="mt-3 text-red-600 text-sm font-medium text-center">订阅失败，请重试</div>}
        </>
      )}
    </div>
  )
}
