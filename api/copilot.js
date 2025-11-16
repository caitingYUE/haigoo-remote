import { setCorsHeaders } from '../server-utils/cors.js'

export default async function handler(req, res) {
  setCorsHeaders(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ success: false })

  const { resume = '' } = req.body || {}
  const text = String(resume).toLowerCase()
  const analysis = []
  if (text.includes('react')) analysis.push('Strong frontend experience (React)')
  if (text.includes('python')) analysis.push('Backend/Data skills with Python')
  if (text.includes('ml') || text.includes('machine learning')) analysis.push('Machine learning exposure detected')
  if (analysis.length === 0) analysis.push('General software experience; add role-specific keywords to improve matching')

  const optimization = [
    'Quantify achievements (metrics, %, time saved)',
    'Add role keywords (e.g., product, algorithm, operations, marketing where relevant)',
    'Highlight remote collaboration tools and async communication',
    'Include links to portfolio or GitHub for evidence'
  ]
  const tips = [
    'Tailor resume to each job; mirror job requirements',
    'Use concise paragraphs and bullet points',
    'Write a short cover letter focusing on impact and fit',
    'Submit during local business hours of hiring company'
  ]

  return res.status(200).json({ success: true, matchAnalysis: analysis, optimization, tips })
}