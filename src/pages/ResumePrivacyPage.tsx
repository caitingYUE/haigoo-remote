import { useEffect, useMemo, useState } from 'react'

function renderInlineLinks(text: string) {
  const nodes: Array<string | { label: string; href: string }> = []
  const regex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    nodes.push({ label: match[1], href: match[2] })
    last = match.index + match[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function MarkdownLine({ line }: { line: string }) {
  const trimmed = line.trim()
  if (!trimmed) return <div className="h-2" />

  const renderText = (value: string) => renderInlineLinks(value).map((part, idx) => {
    if (typeof part === 'string') return <span key={`${part}-${idx}`}>{part}</span>
    return (
      <a key={`${part.href}-${idx}`} href={part.href} target="_blank" rel="noreferrer" className="text-indigo-600 underline underline-offset-2 hover:text-indigo-700">
        {part.label}
      </a>
    )
  })

  if (trimmed.startsWith('# ')) {
    return <h1 className="text-2xl font-bold text-slate-900 mt-2 mb-4">{renderText(trimmed.slice(2))}</h1>
  }
  if (trimmed.startsWith('## ')) {
    return <h2 className="text-lg font-bold text-slate-900 mt-5 mb-2">{renderText(trimmed.slice(3))}</h2>
  }
  if (trimmed.startsWith('### ')) {
    return <h3 className="text-base font-semibold text-slate-900 mt-4 mb-2">{renderText(trimmed.slice(4))}</h3>
  }
  if (/^\d+\.\s+/.test(trimmed)) {
    return <p className="text-sm leading-7 text-slate-700">{renderText(trimmed)}</p>
  }
  if (/^[•*-]\s+/.test(trimmed)) {
    return <p className="text-sm leading-7 text-slate-700 pl-4">{renderText(trimmed)}</p>
  }
  return <p className="text-sm leading-7 text-slate-700">{renderText(trimmed)}</p>
}

export default function ResumePrivacyPage() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let mounted = true
    const loadContent = async () => {
      try {
        const resp = await fetch(`/user_laws/cv.md?t=${Date.now()}`)
        const text = await resp.text()
        if (!resp.ok || !text.trim()) throw new Error('协议内容加载失败')
        if (mounted) {
          setContent(text)
          setLoadError('')
        }
      } catch {
        if (mounted) setLoadError('协议内容加载失败，请稍后重试。')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadContent()
    return () => { mounted = false }
  }, [])

  const lines = useMemo(() => content.split(/\r?\n/), [content])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
        {loading ? (
          <p className="text-sm text-slate-500">协议加载中...</p>
        ) : loadError ? (
          <p className="text-sm text-rose-600">{loadError}</p>
        ) : (
          <article>
            {lines.map((line, idx) => (
              <MarkdownLine key={`${idx}-${line.slice(0, 16)}`} line={line} />
            ))}
          </article>
        )}
      </div>
    </div>
  )
}
