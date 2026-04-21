import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from './NotificationSystem'
import type { Job } from '../types'
import type { ReferralContact } from '../services/trusted-companies-service'

interface ResumeOption {
  id: string
  fileName: string
  createdAt: string
  contentText?: string
  content_text?: string
  parseResult?: any
  parse_result?: any
}

type ResumeLanguageStatus = 'english' | 'mixed' | 'non_english' | 'unknown'

interface EmailConnectModalProps {
  isOpen: boolean
  onClose: () => void
  contact: ReferralContact | null
  job: Job
  onOpenEmail?: (payload: {
    contact: ReferralContact
    resumeId: string
    resumeName: string
    subject: string
    body: string
    email: string
  }) => void
}

function normalizeResumeText(resume: Partial<ResumeOption> | null | undefined) {
  if (!resume) return ''
  if (typeof resume.contentText === 'string' && resume.contentText.trim()) return resume.contentText.trim()
  if (typeof resume.content_text === 'string' && resume.content_text.trim()) return resume.content_text.trim()

  const rawParseResult = resume.parseResult ?? resume.parse_result
  const parsed = typeof rawParseResult === 'string'
    ? (() => {
      try {
        return JSON.parse(rawParseResult)
      } catch {
        return null
      }
    })()
    : rawParseResult

  if (typeof parsed?.text === 'string' && parsed.text.trim()) return parsed.text.trim()
  if (typeof parsed?.content === 'string' && parsed.content.trim()) return parsed.content.trim()
  return ''
}

function detectResumeLanguage(text: string): ResumeLanguageStatus {
  const raw = String(text || '').trim()
  if (!raw) return 'unknown'

  const englishChars = (raw.match(/[A-Za-z]/g) || []).length
  const chineseChars = (raw.match(/[\u4e00-\u9fff]/g) || []).length
  const total = englishChars + chineseChars
  if (!total) return 'unknown'

  const englishRatio = englishChars / total
  const chineseRatio = chineseChars / total

  if (englishRatio >= 0.7 && chineseRatio < 0.1) return 'english'
  if (englishRatio >= 0.35 && chineseRatio >= 0.1) return 'mixed'
  return 'non_english'
}

function getRecipientName(contact: ReferralContact | null) {
  const name = String(contact?.name || '').trim()
  if (!name) return 'there'
  const stripped = name.replace(/[^\p{L}\s-]/gu, '').trim()
  if (!stripped) return 'there'
  return stripped.split(/\s+/)[0]
}

function extractResumeHighlights(text: string) {
  const normalized = String(text || '').toLowerCase()
  if (!normalized) return []

  const dictionary = [
    'ai', 'llm', 'product', 'growth', 'marketing', 'sales', 'design', 'research', 'operations',
    'python', 'sql', 'typescript', 'javascript', 'react', 'node', 'analytics', 'strategy',
    'machine learning', 'data', 'b2b', 'saas', 'leadership', 'prompt'
  ]

  const matched = dictionary.filter((term) => normalized.includes(term)).slice(0, 3)
  if (matched.length > 0) {
    return matched.map((term) => term === 'ai' ? 'AI' : term.replace(/\b\w/g, (char) => char.toUpperCase()))
  }

  const fallback = Array.from(new Set((text.match(/\b[A-Z][A-Za-z+\-]{2,}\b/g) || []).map((item) => item.trim()))).slice(0, 3)
  return fallback
}

function buildEmailSubject(job: Job) {
  const title = String(job.title || job.translations?.title || 'the role').trim()
  const company = String(job.company || job.translations?.company || 'your company').trim()
  return `Application for ${title} at ${company}`
}

function buildEmailBody(job: Job, contact: ReferralContact | null, userName?: string | null, resumeText?: string) {
  const recipient = getRecipientName(contact)
  const title = String(job.title || job.translations?.title || 'the role').trim()
  const company = String(job.company || job.translations?.company || 'your company').trim()
  const sender = String(userName || '').trim() || '[Your Name]'
  const highlights = extractResumeHighlights(resumeText || '')
  const experienceLine = highlights.length > 0
    ? `My background in ${highlights.join(', ')} aligns well with this role, and I believe I can contribute quickly.`
    : 'My background aligns well with the role, and I believe I can contribute quickly.'

  return `Hi ${recipient},

I hope you're doing well.

I came across the ${title} role at ${company} and I'm very interested in the opportunity.

${experienceLine}

I have attached my resume for your review. If the role is still open, I would be grateful for any guidance or the opportunity to be considered by the hiring team.

Thank you for your time and consideration.

Best regards,
${sender}`
}

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function addDefaultEmailHighlights(line: string) {
  return line
    .replace(/\bvery interested\b/gi, '<strong>$&</strong>')
    .replace(/\battached my resume\b/gi, '<strong>$&</strong>')
    .replace(/\bThank you for your time and consideration\b/gi, '<strong>$&</strong>')
}

function plainTextToEditableHtml(text: string) {
  const lines = String(text || '').split('\n')
  if (lines.length === 0) return '<div><br></div>'

  return lines.map((line) => {
    if (!line.trim()) return '<div><br></div>'
    return `<div>${addDefaultEmailHighlights(escapeHtml(line))}</div>`
  }).join('')
}

function editableHtmlToPlainText(html: string) {
  if (!html) return ''
  const normalizedHtml = html
    .replace(/<div><br><\/div>/gi, '\n')
    .replace(/<\/div>\s*<div>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?div>/gi, '')

  if (typeof document === 'undefined') {
    return normalizedHtml.replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim()
  }

  const temp = document.createElement('div')
  temp.innerHTML = normalizedHtml
  return (temp.textContent || '').replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

export const EmailConnectModal: React.FC<EmailConnectModalProps> = ({
  isOpen,
  onClose,
  contact,
  job,
  onOpenEmail,
}) => {
  const { token, user } = useAuth()
  const { showError } = useNotificationHelpers()
  const [resumes, setResumes] = useState<ResumeOption[]>([])
  const [selectedResumeId, setSelectedResumeId] = useState('')
  const [selectedResumeText, setSelectedResumeText] = useState('')
  const [resumeLanguageStatus, setResumeLanguageStatus] = useState<ResumeLanguageStatus>('unknown')
  const [isLoadingResumes, setIsLoadingResumes] = useState(false)
  const [copiedField, setCopiedField] = useState<'email' | 'subject' | 'body' | null>(null)
  const [draftSubject, setDraftSubject] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const bodyEditorRef = useRef<HTMLDivElement | null>(null)

  const selectedResume = useMemo(
    () => resumes.find((resume) => resume.id === selectedResumeId) || null,
    [resumes, selectedResumeId]
  )

  const senderName = String(user?.profile?.fullName || user?.username || user?.email?.split('@')[0] || '').trim()
  const recipientEmail = String(contact?.hiringEmail || '').trim()
  const emailSubject = useMemo(() => buildEmailSubject(job), [job])
  const emailBody = useMemo(() => buildEmailBody(job, contact, senderName, selectedResumeText), [job, contact, senderName, selectedResumeText])

  useEffect(() => {
    if (!isOpen || !token) return
    setCopiedField(null)
    fetchResumes()
  }, [isOpen, token])

  useEffect(() => {
    if (!isOpen) return
    setDraftSubject(emailSubject)
  }, [isOpen, emailSubject])

  useEffect(() => {
    if (!isOpen) return
    setDraftBody(emailBody)
  }, [isOpen, emailBody])

  useEffect(() => {
    if (!isOpen || !bodyEditorRef.current) return
    bodyEditorRef.current.innerHTML = plainTextToEditableHtml(emailBody)
  }, [isOpen, emailBody])

  useEffect(() => {
    if (!selectedResume) {
      setSelectedResumeText('')
      setResumeLanguageStatus('unknown')
      return
    }

    const existingText = normalizeResumeText(selectedResume)
    if (existingText) {
      setSelectedResumeText(existingText)
      setResumeLanguageStatus(detectResumeLanguage(existingText))
      return
    }

    if (!token || !selectedResume.id) {
      setSelectedResumeText('')
      setResumeLanguageStatus('unknown')
      return
    }

    let cancelled = false
    const loadResumeContent = async () => {
      try {
        const response = await fetch(`/api/resumes?action=content&id=${selectedResume.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await response.json().catch(() => ({}))
        const text = normalizeResumeText(data?.data || data || {})
        if (!cancelled) {
          setSelectedResumeText(text)
          setResumeLanguageStatus(detectResumeLanguage(text))
        }
      } catch (_error) {
        if (!cancelled) {
          setSelectedResumeText('')
          setResumeLanguageStatus('unknown')
        }
      }
    }

    loadResumeContent()
    return () => {
      cancelled = true
    }
  }, [selectedResume, token])

  const fetchResumes = async () => {
    if (!token) return
    setIsLoadingResumes(true)
    try {
      const response = await fetch('/api/resumes', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json().catch(() => ({}))
      const nextResumes = Array.isArray(data?.data)
        ? data.data.map((resume: any) => ({
          ...resume,
          id: String(resume.id || resume.resume_id || ''),
          fileName: resume.fileName || resume.file_name || 'Resume',
          createdAt: resume.created_at || resume.createdAt || resume.uploadedAt || new Date().toISOString(),
        }))
          .filter((resume: ResumeOption) => resume.id)
          .sort((a: ResumeOption, b: ResumeOption) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        : []

      setResumes(nextResumes)
      setSelectedResumeId((current) => {
        if (current && nextResumes.some((resume: ResumeOption) => resume.id === current)) return current
        return nextResumes[0]?.id || ''
      })
    } catch (error) {
      console.error('Failed to fetch resumes:', error)
      showError('无法加载简历', '请稍后重试')
    } finally {
      setIsLoadingResumes(false)
    }
  }

  const handleCopy = async (field: 'email' | 'subject' | 'body', value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(field)
      window.setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 1500)
    } catch (_error) {
      showError('复制失败', '请手动复制内容')
    }
  }

  const handleOpenEmail = () => {
    if (!contact || !recipientEmail) return

    onOpenEmail?.({
      contact,
      resumeId: selectedResume?.id || '',
      resumeName: selectedResume?.fileName || '',
      subject: draftSubject,
      body: draftBody,
      email: recipientEmail,
    })

    window.location.href = `mailto:${recipientEmail}?subject=${encodeURIComponent(draftSubject)}&body=${encodeURIComponent(draftBody)}`
  }

  const syncBodyEditorValue = () => {
    if (!bodyEditorRef.current) return
    setDraftBody(editableHtmlToPlainText(bodyEditorRef.current.innerHTML))
  }

  const handleBodyKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
      event.preventDefault()
      if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
        document.execCommand('bold')
        window.requestAnimationFrame(() => syncBodyEditorValue())
      }
    }
  }

  if (!isOpen || !contact) return null

  return createPortal(
    <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
        <div className="relative z-10 flex max-h-[92vh] w-full max-w-[820px] flex-col overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_50px_120px_-42px_rgba(15,23,42,0.45)]">
          <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
            <div className="min-w-0">
              <h3 className="text-[26px] font-black tracking-tight text-slate-950">一键邮箱直申</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                下面是可直接使用的英文邮件内容。打开邮箱后，请手动添加简历附件再发送。
              </p>
            </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {resumeLanguageStatus === 'non_english' && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              当前参考简历看起来主要是非英文内容，建议优先替换为英文或中英双语简历，再发送这封邮件。
            </div>
          )}

          <div className="grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="mb-2 text-xs font-semibold tracking-[0.16em] text-slate-400">收件邮箱</div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="min-w-0 flex-1 text-base font-semibold text-slate-900">{recipientEmail || '-'}</div>
                <button
                  type="button"
                  onClick={() => handleCopy('email', recipientEmail)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
                  aria-label="复制收件邮箱"
                >
                  {copiedField === 'email' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="mb-2 text-xs font-semibold tracking-[0.16em] text-slate-400">邮件标题</div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <input
                  value={draftSubject}
                  onChange={(event) => setDraftSubject(event.target.value)}
                  className="min-w-0 flex-1 border-0 bg-transparent text-base font-semibold text-slate-900 outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleCopy('subject', draftSubject)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
                  aria-label="复制邮件标题"
                >
                  {copiedField === 'subject' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="mb-2 text-xs font-semibold tracking-[0.16em] text-slate-400">邮件正文</div>
              <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                <strong>请注意：</strong> 打开邮箱客户端后，记得手动添加简历附件。一键复制只会复制文字内容，不会带上文件。
              </div>
              <div
                ref={bodyEditorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={syncBodyEditorValue}
                onBlur={syncBodyEditorValue}
                onKeyDown={handleBodyKeyDown}
                className="min-h-[360px] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-[15px] leading-7 text-slate-900 outline-none transition-colors focus:border-indigo-200 focus:ring-2 focus:ring-indigo-100"
              />
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                如需更个性化的邮件内容，可以先在个人中心上传英文或中英双语简历，系统会自动参考简历优化文案。
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleCopy('body', draftBody)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-950"
                >
                  {copiedField === 'body' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  复制正文
                </button>
              </div>
            </div>
          </div>

          {isLoadingResumes ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-500">
              正在读取你已上传的简历...
            </div>
          ) : resumes.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-600">
              当前已参考简历：<span className="font-semibold text-slate-900">{selectedResume?.fileName || '最近上传的简历'}</span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3 border-t border-slate-100 px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleOpenEmail}
            disabled={!recipientEmail}
            className="flex-1 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            打开邮箱
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default EmailConnectModal
