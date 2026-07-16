import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle2, Mail, RefreshCw, Send, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface EmailVerificationRequiredModalProps {
  isOpen: boolean
  onClose: () => void
  actionLabel?: string
}

export default function EmailVerificationRequiredModal({
  isOpen,
  onClose,
  actionLabel = '使用岗位功能'
}: EmailVerificationRequiredModalProps) {
  const { user, sendVerificationEmail, refreshUser } = useAuth()
  const [isResending, setIsResending] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('success')

  useEffect(() => {
    if (isOpen && user?.emailVerified) onClose()
  }, [isOpen, onClose, user?.emailVerified])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || typeof document === 'undefined') return null

  const handleResend = async () => {
    if (!user?.email || isResending) return
    setIsResending(true)
    setMessage('')
    try {
      const result = await sendVerificationEmail(user.email)
      setMessageTone(result.success ? 'success' : 'error')
      setMessage(result.success ? '验证邮件已发送，请前往邮箱完成验证。' : (result.message || '发送失败，请稍后重试。'))
    } catch {
      setMessageTone('error')
      setMessage('发送失败，请检查网络后重试。')
    } finally {
      setIsResending(false)
    }
  }

  const handleRefresh = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    setMessage('')
    try {
      await refreshUser()
      setMessageTone('success')
      setMessage('状态已刷新；若已完成验证，现在可以继续操作。')
    } finally {
      setIsRefreshing(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-verification-title"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_24px_72px_-28px_rgba(15,23,42,0.42)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="关闭"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="pr-10">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f3f0ff] text-[#6251f5]">
            <Mail className="h-5 w-5" />
          </span>
          <h2 id="email-verification-title" className="mt-4 text-xl font-black text-slate-950">验证邮箱后继续</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            完成邮箱验证后即可{actionLabel}。
          </p>
        </div>

        <div className="mt-5 space-y-3">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs font-bold text-slate-400">当前邮箱</div>
            <div className="mt-1 break-all text-sm font-bold text-slate-700">{user?.email || '当前账户邮箱'}</div>
          </div>

          {message ? (
            <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold leading-6 ${messageTone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {messageTone === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{message}</span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#6251f5] px-5 text-sm font-black text-white transition hover:bg-[#5142df] disabled:cursor-wait disabled:opacity-70"
          >
            <Send className="h-4 w-4" />
            {isResending ? '发送中…' : '重新发送验证邮件'}
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-black text-slate-600 transition hover:border-[#d8d2ff] hover:text-[#6251f5] disabled:cursor-wait disabled:opacity-70"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? '刷新中…' : '我已验证，刷新状态'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
