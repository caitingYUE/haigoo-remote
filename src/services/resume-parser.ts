import JSZip from 'jszip'
import { ParsedResume } from '../types/resume-types'

function normalizeText(input: string): string {
  return input
    .replace(/\r\n|\r/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/\t/g, ' ')
    .replace(/ +/g, ' ')
    .trim()
}

async function extractTextFromDocx(file: File): Promise<string> {
  try {
    const buf = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(buf)
    const doc = zip.file('word/document.xml')
    if (!doc) return ''
    const xml = await doc.async('string')
    // 粗略提取文本：按段落换行，去除所有标签
    const withBreaks = xml.replace(/<w:p[^>]*>/g, '\n')
    const textOnly = withBreaks.replace(/<[^>]+>/g, '')
    return normalizeText(textOnly)
  } catch (e) {
    console.warn('DOCX解析失败:', e)
    return ''
  }
}

async function extractTextFromTxt(file: File): Promise<string> {
  const text = await file.text()
  return normalizeText(text)
}

async function extractTextViaServer(file: File): Promise<string | null> {
  try {
    const form = new FormData()
    form.append('file', file)
    const resp = await fetch('/api/parse-resume', {
      method: 'POST',
      body: form
    })
    if (!resp.ok) return null
    const json = await resp.json().catch(() => null)
    const text = json?.data?.text as string | undefined
    return text ? normalizeText(text) : null
  } catch (e) {
    // 本地开发或网络错误时返回 null，让调用方采用本地解析回退
    return null
  }
}

function pickSection(text: string, headerPatterns: RegExp[], nextHeaderHint?: RegExp): string | undefined {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (headerPatterns.some((re) => re.test(line))) {
      const collected: string[] = []
      for (let j = i + 1; j < Math.min(lines.length, i + 10); j++) {
        const ln = lines[j]
        if (nextHeaderHint && nextHeaderHint.test(ln)) break
        collected.push(ln)
      }
      const block = collected.join('\n').trim()
      return block || undefined
    }
  }
  return undefined
}

function simpleResumeFieldsFromText(text: string): ParsedResume {
  const get = (re: RegExp) => {
    const m = text.match(re)
    return m?.[1]?.trim()
  }

  const name = get(/(?:姓名|Name)[:：]?\s*([^\n]{1,40})/i) || text.split('\n')[0]?.slice(0, 40)
  const title = get(/(?:Title|职位|职称|岗位)[:：]?\s*([^\n]{1,60})/i)
  const gender = get(/(?:性别|Gender)[:：]?\s*(男|女|male|female)/i)
  const location = get(/(?:地点|所在地|现居地|Location|地址)[:：]?\s*([^\n]{1,60})/i)
  const targetRole = get(/(?:求职意向|求职方向|目标岗位|Desired Role|Target)[:：]?\s*([^\n]{1,80})/i)
  const graduationYear = get(/(?:毕业年份|毕业年限|Graduation Year)[:：]?\s*(\d{4})/i) || get(/毕业[^\d]*(\d{4})/i)
  const education = pickSection(text,
    [/教育背景/i, /教育经历/i, /Education/i],
    /(工作经历|项目经历|Experience|Summary)/i
  )
  const summary = pickSection(text,
    [/个人简介/i, /Summary/i, /Profile/i],
    /(工作经历|项目经历|Education)/i
  )

  const success = Boolean((name && name.length > 0) || education || summary || targetRole || title)
  return { success, textContent: text, name, title, gender, location, targetRole, education, graduationYear, summary }
}

export async function parseResumeFile(file: File): Promise<ParsedResume> {
  const ext = file.name.toLowerCase()
  const isDocx = ext.endsWith('.docx') || file.type.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  const isTxt = ext.endsWith('.txt') || file.type.startsWith('text/')

  // 优先尝试服务端解析（支持 PDF/DOC/图片等多格式）
  const serverText = await extractTextViaServer(file)
  if (serverText) {
    return simpleResumeFieldsFromText(serverText)
  }

  if (isDocx) {
    const text = await extractTextFromDocx(file)
    if (!text) return { success: false }
    return simpleResumeFieldsFromText(text)
  }
  if (isTxt) {
    const text = await extractTextFromTxt(file)
    if (!text) return { success: false }
    return simpleResumeFieldsFromText(text)
  }

  // 其他类型在本地回退失败时返回失败（部署到Vercel后会由服务端解析覆盖）
  return { success: false }
}