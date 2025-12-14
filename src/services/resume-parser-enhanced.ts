/**
 * 增强的简历解析器 - 纯前端实现
 * 支持 PDF、DOCX、TXT 格式
 * 使用第三方库：pdfjs-dist（PDF）、自定义 DOCX 解析
 */

import JSZip from 'jszip'
import { ParsedResume } from '../types/resume-types'

// PDF.js 动态导入（使用 CDN 版本以避免打包问题）
let pdfjsLib: any = null

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib

  // 动态加载 PDF.js
  if (typeof window !== 'undefined') {
    // @ts-ignore
    if (window.pdfjsLib) {
      // @ts-ignore
      pdfjsLib = window.pdfjsLib
    } else {
      // 加载 PDF.js CDN
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      document.head.appendChild(script)

      await new Promise((resolve, reject) => {
        script.onload = resolve
        script.onerror = reject
      })

      // @ts-ignore
      pdfjsLib = window.pdfjsLib
      // @ts-ignore
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    }
  }

  return pdfjsLib
}

function normalizeText(input: string): string {
  return input
    .replace(/\r\n|\r/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/\t/g, ' ')
    .replace(/ +/g, ' ')
    .trim()
}

/**
 * 解析 PDF 文件（使用 PDF.js）
 */
async function extractTextFromPdf(file: File): Promise<string> {
  try {
    const lib = await loadPdfJs()
    if (!lib) {
      console.warn('PDF.js not loaded')
      return ''
    }

    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = lib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise

    const textParts: string[] = []

    // 提取所有页面的文本
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
      textParts.push(pageText)
    }

    return normalizeText(textParts.join('\n'))
  } catch (e) {
    console.error('PDF解析失败:', e)
    return ''
  }
}

/**
 * 解析 DOCX 文件（使用 JSZip）
 */
async function extractTextFromDocx(file: File): Promise<string> {
  try {
    const buf = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(buf)
    const doc = zip.file('word/document.xml')
    if (!doc) return ''

    const xml = await doc.async('string')

    // 提取文本：保留段落结构
    const withBreaks = xml
      .replace(/<w:p[^>]*>/g, '\n')  // 段落
      .replace(/<w:br[^>]*\/>/g, '\n')  // 换行
      .replace(/<w:tab[^>]*\/>/g, '\t')  // 制表符

    const textOnly = withBreaks.replace(/<[^>]+>/g, '')

    return normalizeText(textOnly)
  } catch (e) {
    console.error('DOCX解析失败:', e)
    return ''
  }
}

/**
 * 解析 TXT 文件
 */
async function extractTextFromTxt(file: File): Promise<string> {
  try {
    const text = await file.text()
    return normalizeText(text)
  } catch (e) {
    console.error('TXT解析失败:', e)
    return ''
  }
}

/**
 * 尝试通过服务端解析（优先方案）
 */
async function extractDataViaServer(file: File): Promise<ParsedResume | null> {
  try {
    const form = new FormData()
    form.append('file', file)

    // 尝试新的解析接口
    const token = localStorage.getItem('haigoo_auth_token')
    const headers: HeadersInit = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const resp = await fetch('/api/parse-resume-new', {
      method: 'POST',
      headers,
      body: form
    })

    if (!resp.ok) {
      console.warn('Server parse failed:', resp.status)
      return null
    }

    const json = await resp.json()
    if (!json.success || !json.data) {
      console.warn('Server parse returned no data')
      return null
    }

    const data = json.data

    // 如果是 Python 解析结果，直接映射
    if (data.name || data.email || data.mobile_number) {
      return {
        success: true,
        id: json.id,
        textContent: data.text || '',
        name: data.name,
        title: data.designation ? (Array.isArray(data.designation) ? data.designation[0] : data.designation) : undefined,
        gender: undefined, // pyresparser doesn't extract gender usually
        location: undefined,
        targetRole: undefined,
        education: data.degree ? (Array.isArray(data.degree) ? data.degree.join('\n') : data.degree) : undefined,
        graduationYear: undefined,
        summary: undefined,
        workExperience: data.experience ? (Array.isArray(data.experience) ? data.experience.join('\n') : data.experience) : undefined,
        skills: data.skills ? (Array.isArray(data.skills) ? data.skills.join(', ') : data.skills) : undefined
      }
    }

    // 如果是 fallback 文本结果
    if (data.text) {
      return {
        ...extractResumeFields(normalizeText(data.text)),
        id: json.id
      }
    }
    
    // Even if no text, return ID so we can update it later
    if (json.id) {
       return {
         success: false,
         id: json.id
       }
    }

    return null
  } catch (e) {
    console.warn('Server parse error:', e)
    return null
  }
}

/**
 * 从文本中提取段落
 */
function pickSection(
  text: string,
  headerPatterns: RegExp[],
  nextHeaderHint?: RegExp
): string | undefined {
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (headerPatterns.some((re) => re.test(line))) {
      const collected: string[] = []

      // 收集接下来的几行，直到遇到下一个标题
      for (let j = i + 1; j < Math.min(lines.length, i + 15); j++) {
        const ln = lines[j].trim()
        if (!ln) continue // 跳过空行
        if (nextHeaderHint && nextHeaderHint.test(ln)) break
        collected.push(ln)
      }

      const block = collected.join('\n').trim()
      return block || undefined
    }
  }

  return undefined
}

/**
 * 从文本中提取简历字段
 */
function extractResumeFields(text: string): ParsedResume {
  const get = (re: RegExp) => {
    const m = text.match(re)
    return m?.[1]?.trim()
  }

  const getAll = (re: RegExp) => {
    const matches = text.matchAll(re)
    return Array.from(matches).map(m => m[1]?.trim()).filter(Boolean)
  }

  // 提取姓名（增强多种格式识别）
  const name =
    get(/(?:姓\s*名|Name)[:：\s]*([^\n]{1,40})/i) ||
    get(/^([^\n的]{2,20})\s*(?:的个人简历|简历|Resume)/im) ||
    get(/^([A-Z][a-z]+\s+[A-Z][a-z]+)$/m) || // 英文名
    get(/^([^\n]{2,15})$/m) // 第一行短文本

  // 提取职位/标题（增强）
  const title =
    get(/(?:Title|职位|职称|岗位|应聘职位|期望职位)[:：\s]*([^\n]{1,80})/i) ||
    get(/(?:求职意向|目标岗位)[:：\s]*([^\n]{1,80})/i) ||
    get(/([^\n]{3,40}(?:工程师|开发|设计师|经理|总监|主管|专员|架构师|顾问))/i)

  // 提取性别（增强）
  const gender =
    get(/(?:性别|Gender|Sex)[:：\s]*(男|女|Male|Female|M|F)/i) ||
    get(/\b(男|女)\b/i)

  // 提取地点（增强城市识别）
  const location =
    get(/(?:地点|所在地|现居地|居住地|Location|城市|City|居住城市)[:：\s]*([^\n]{1,60})/i) ||
    get(/(?:地址|Address|现住址)[:：\s]*([^\n]{1,100})/i) ||
    get(/(北京|上海|深圳|广州|杭州|成都|武汉|西安|南京|天津|重庆|苏州|长沙)[市]?[^\n]{0,20}/i)

  // 提取求职意向（增强）
  const targetRole =
    get(/(?:求职意向|求职方向|目标岗位|期望职位|应聘岗位)[:：\s]*([^\n]{1,100})/i) ||
    get(/(?:Desired Role|Target Position|Objective)[:：\s]*([^\n]{1,100})/i) ||
    get(/(?:意向|期望)[^\n]*(?:职位|岗位|工作)[:：\s]*([^\n]{1,80})/i)

  // 提取毕业年份（增强）
  const graduationYear =
    get(/(?:毕业年份|毕业时间|Graduation Year|毕业)[:：\s]*(\d{4})/i) ||
    get(/(?:毕业|Graduated)[^\d]*(\d{4})/i) ||
    get(/(\d{4})[年\-\.\/]\d{1,2}[^\d]*(?:毕业|至今)/i)

  // 提取教育背景段落（增强）
  const education =
    pickSection(
      text,
      [/教育背景/i, /教育经历/i, /学历/i, /Education/i, /Educational Background/i],
      /(?:工作经历|项目经历|Experience|Summary|技能|个人技能)/i
    ) || get(/(?:大学|University|学院|College)[^\n]{5,80}/i)

  // 提取个人简介（增强）
  const summary =
    pickSection(
      text,
      [/个人简介/i, /自我评价/i, /个人评价/i, /Summary/i, /Profile/i, /Objective/i, /自我介绍/i],
      /(?:工作经历|项目经历|Education|教育|技能)/i
    )

  // 提取工作经历（增强，支持多段）
  const workExperience =
    pickSection(
      text,
      [/工作经历/i, /工作经验/i, /Work Experience/i, /Experience/i, /Employment/i, /职业经历/i],
      /(?:项目经历|教育背景|技能|个人技能|自我评价)/i
    )

  // 提取技能（增强）
  const skills =
    pickSection(
      text,
      [/技能/i, /专业技能/i, /Skills/i, /Technical Skills/i, /核心技能/i, /掌握技能/i],
      /(?:工作经历|项目经历|教育|自我评价|个人简介)/i
    ) || getAll(/(?:熟练|熟悉|掌握|精通|了解)([^\n。；]{5,50})/gi).slice(0, 5).join('、')

  // 判断解析是否成功（至少有一个有效字段）
  const success = Boolean(
    (name && name.length > 1) ||
    education ||
    summary ||
    workExperience ||
    targetRole ||
    title
  )

  return {
    success,
    textContent: text,
    name,
    title,
    gender,
    location,
    targetRole,
    education,
    graduationYear,
    summary,
    workExperience,
    skills
  }
}

/**
 * 主解析函数 - 自动检测格式并解析
 */
export async function parseResumeFileEnhanced(file: File): Promise<ParsedResume> {
  const fileName = file.name.toLowerCase()
  const fileType = file.type.toLowerCase()

  console.log(`[resume-parser] Parsing: ${file.name} (${fileType})`)

  // 1. 优先尝试服务端解析 (pyresparser)
  console.log(`[resume-parser] Trying server parse...`)
  const serverResult = await extractDataViaServer(file)
  if (serverResult && serverResult.success) {
    console.log(`[resume-parser] Server parse success`)
    return serverResult
  }

  // Capture ID from server if available (even if parse failed)
  const serverId = serverResult?.id

  let text = ''

  // 2. 如果服务端失败，尝试前端解析（回退方案）
  if (fileName.endsWith('.pdf') || fileType.includes('pdf')) {
    text = await extractTextFromPdf(file)
    if (text) {
      console.log(`[resume-parser] PDF parsed locally, ${text.length} chars`)
      return { ...extractResumeFields(text), id: serverId }
    }
  }

  if (
    fileName.endsWith('.docx') ||
    fileType.includes('officedocument.wordprocessingml')
  ) {
    text = await extractTextFromDocx(file)
    if (text) {
      console.log(`[resume-parser] DOCX parsed locally, ${text.length} chars`)
      return { ...extractResumeFields(text), id: serverId }
    }
  }

  if (fileName.endsWith('.txt') || fileType.startsWith('text/')) {
    text = await extractTextFromTxt(file)
    if (text) {
      console.log(`[resume-parser] TXT parsed locally, ${text.length} chars`)
      return { ...extractResumeFields(text), id: serverId }
    }
  }

  // 3. 所有方法都失败
  console.error(`[resume-parser] All parse methods failed for ${file.name}`)
  return {
    success: false,
    id: serverId,
    textContent: '',
    name: undefined,
    title: undefined
  }
}

// 向后兼容的导出
export async function parseResumeFile(file: File): Promise<ParsedResume> {
  return parseResumeFileEnhanced(file)
}

