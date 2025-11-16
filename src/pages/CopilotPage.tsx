import React, { useState } from 'react'

export default function CopilotPage() {
  const [resume, setResume] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const analyze = async () => {
    if (!resume.trim()) return
    setLoading(true)
    try {
      const resp = await fetch('/api/auth?action=copilot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resume }) })
      const json = await resp.json()
      setResult(json)
    } finally { setLoading(false) }
  }

  return (
    <div className="container-fluid section-padding">
      <h1 className="text-3xl font-bold">AI Copilot</h1>
      <p className="text-gray-600 mt-2">Resume matching analysis · Optimization suggestions · Application tips</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <textarea className="input h-64" placeholder="Paste your resume text here..." value={resume} onChange={e=>setResume(e.target.value)} />
        <div className="rounded-2xl border p-6 bg-white">
          <button onClick={analyze} className="btn btn-primary">Analyze</button>
          {loading && <div className="mt-4">Analyzing...</div>}
          {result && (
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Match Analysis</h3>
                <ul className="list-disc ml-5 text-gray-700">
                  {(result.matchAnalysis || []).map((s:string, i:number)=>(<li key={i}>{s}</li>))}
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Optimization Suggestions</h3>
                <ul className="list-disc ml-5 text-gray-700">
                  {(result.optimization || []).map((s:string, i:number)=>(<li key={i}>{s}</li>))}
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Application Tips</h3>
                <ul className="list-disc ml-5 text-gray-700">
                  {(result.tips || []).map((s:string, i:number)=>(<li key={i}>{s}</li>))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
