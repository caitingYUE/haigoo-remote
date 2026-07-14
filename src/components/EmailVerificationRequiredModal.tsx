import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Mail, RefreshCw, Send, X } from 'lucide-react'
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
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-verification-title"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_32px_100px_-30px_rgba(15,23,42,0.48)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="关闭"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="bg-[linear-gradient(135deg,#f5f2ff_0%,#f8fbff_58%,#fffaf0_100%)] px-7 pb-6 pt-8 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#6251f5] shadow-[0_16px_36px_-22px_rgba(98,81,245,0.6)]">
            <Mail className="h-7 w-7" />
          </span>
          <h2 id="email-verification-title" className="mt-5 text-2xl font-black text-slate-950">请先验证邮箱</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            为防止虚假邮箱重复获取体验次数，验证邮箱后才可{actionLabel}。其他页面仍可正常浏览。
          </p>
        </div>

        <div className="space-y-4 px-7 py-6">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="text-xs font-bold text-slate-400">验证邮件将发送至</div>
            <div className="mt-1 break-all text-sm font-black text-slate-800">{user?.email || '当前账户邮箱'}</div>
          </div>

          {message ? (
            <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold leading-6 ${messageTone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{message}</span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#6251f5] px-5 text-sm font-black text-white transition hover:bg-[#5142df] disabled:cursor-wait disabled:opacity-70"
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
