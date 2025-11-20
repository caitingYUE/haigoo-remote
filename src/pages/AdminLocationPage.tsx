import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function AdminLocationPage() {
  const { isAuthenticated } = useAuth()
  const [cats, setCats] = useState<{ domesticKeywords: string[]; overseasKeywords: string[]; globalKeywords: string[] }>({ domesticKeywords: [], overseasKeywords: [], globalKeywords: [] })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      const r = await fetch('/api/user-profile?action=location_categories_get')
      const j = await r.json().catch(() => ({}))
      setCats(j.categories || { domesticKeywords: [], overseasKeywords: [], globalKeywords: [] })
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const r = await fetch('/api/user-profile?action=location_categories_set', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cats) })
      if (!r.ok) throw new Error('save failed')
    } catch { }
    setSaving(false)
  }

  const renderEditor = (label: string, key: keyof typeof cats) => (
    <div className="p-4 bg-white rounded-xl border">
      <h3 className="text-sm font-semibold mb-2">{label}</h3>
      <textarea
        className="w-full h-28 border rounded-lg p-2 text-sm"
        value={(cats[key] || []).join('\n')}
        onChange={(e) => setCats(prev => ({ ...prev, [key]: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) }))}
      />
    </div>
  )

  if (!isAuthenticated) return (<div className="p-8"><p>请先登录</p></div>)

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">地址分类管理</h1>
      <p className="text-sm text-gray-500">按行填写关键字，前端按包含匹配；anywhere/everywhere/worldwide/remote 属于 Global（两边都显示）。</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {renderEditor('国内关键词', 'domesticKeywords')}
        {renderEditor('海外关键词', 'overseasKeywords')}
        {renderEditor('Global 关键词', 'globalKeywords')}
      </div>
      <div className="flex justify-end">
        <button onClick={save} className="px-4 py-2 rounded-lg bg-[#3182CE] text-white shadow-sm" disabled={saving}>{saving ? '保存中...' : '保存'}</button>
      </div>
    </div>
  )
}