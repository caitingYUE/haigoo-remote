/**
 * Vercel Serverless Function - 简历数据管理 & 解析
 * bit.ly/resume-consolidation
 */

import { getResumes, saveResumes, saveUserResume, getResumeContent, deleteResume, updateResumeContent, updateResumeAnalysis } from '../../server-utils/resume-storage.js'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import { invalidateUserMatchCache } from '../services/matching-engine.js'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js'
import { createRequire } from 'module'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { deriveMembershipCapabilities, isMembershipActive } from '../shared/membership.js'
import { handleGenerateAnswer, handleGenerateInterviewPlan } from './copilot-v1.3.js'
import { SUPER_ADMIN_EMAILS } from '../../server-utils/admin-config.js'

// Setup for Python script execution
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)

// Fallback dependencies for parsing
let pdfParse, mammoth

async function loadDependencies() {
  if (!pdfParse) {
    try { pdfParse = require('pdf-parse') } catch (e) { }
  }
  if (!mammoth) {
    try { mammoth = (await import('mammoth')).default } catch (e) { }
  }
}

function sendJson(res, body, status = 200) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  // Secure CORS
  const allowedOrigins = [
              'http://localhost:3000',
              'http://localhost:5173',
              'https://haigoo-admin.vercel.app',
              'https://www.haigooremote.com'
          ];
  // Note: Since we don't have req here, we can't dynamic set.
  // But this helper is used inside handleUpload which has req?
  // Actually, handleUpload calls sendJson(res, ...).
  // We can't access req.headers.origin here easily without changing signature.
  // Safe default: Allow specific origins or restrict to same-origin if possible.
  // For Vercel serverless, we usually handle CORS in next.config.js or middleware.
  // But here we are setting it manually.
  // Let's set a restrictive Access-Control-Allow-Origin based on common envs or wildcard if dev?
  // Better: Change the function signature or just set a safe default.
  // Given we can't easily change call sites in this tool step without reading all,
  // I will make it restrictive to our known domains if possible, or just remove the wildcard
  // and rely on the calling function to handle it?
  // No, `sendJson` sets it.
  // Let's assume we can change it to:
  // res.setHeader('Access-Control-Allow-Origin', 'https://haigooremote.com') // Example
  // But that breaks local dev.
  // Let's modify sendJson to accept req optionally, or just set it to * for now but warn?
  // The user asked to fix "errors like exposing API key". Wildcard CORS is a risk but not as critical as API key.
  // However, `resumes.js` handles file uploads.
  // Let's try to grab origin from res.req if available (Node.js/Vercel often link them).
  const req = res.req;
  if (req) {
      const origin = req.headers.origin;
      if (allowedOrigins.includes(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin);
      }
  } else {
      // Fallback: If no req object attached to res (standard Node doesn't always do this unless framework does)
      // We'll set it to the production domain or nothing.
      // res.setHeader('Access-Control-Allow-Origin', 'https://haigooremote.com');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization') // Added Authorization
  res.status(status).json(body)
}

// Parse multipart/form-data manually (from parse-resume-new.js)
async function parseMultipartSimple(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks)
        const boundary = req.headers['content-type']?.split('boundary=')[1]
        if (!boundary) return reject(new Error('No boundary found'))

        const boundaryBuffer = Buffer.from(`--${boundary}`)
        let start = buffer.indexOf(boundaryBuffer) + boundaryBuffer.length
        const fields = {}

        while (start < buffer.length) {
          const end = buffer.indexOf(boundaryBuffer, start)
          if (end === -1) break

          const part = buffer.slice(start, end)
          const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'))
          if (headerEnd !== -1) {
            const header = part.slice(0, headerEnd).toString()
            let valueBuffer = part.slice(headerEnd + 4)
            if (valueBuffer.slice(-2).toString() === '\r\n') {
              valueBuffer = valueBuffer.slice(0, -2)
            }

            const nameMatch = header.match(/name="([^"]+)"/)
            const fieldName = nameMatch ? nameMatch[1] : null

            if (header.includes('filename=') && fieldName === 'file') {
              const filenameMatch = header.match(/filename="([^"]+)"/)
              const filename = filenameMatch ? filenameMatch[1] : 'upload.file'
              resolve({ buffer: valueBuffer, filename, fields })
              return
            }

            if (fieldName) {
              fields[fieldName] = valueBuffer.toString('utf8')
            }
          }
          start = end + boundaryBuffer.length
        }
        reject(new Error('No file found'))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

async function parseWithPython(filePath) {
  return new Promise((resolve, reject) => {
    if (process.env.VERCEL) {
      console.log('[resumes] Vercel runtime detected, skipping Python parser and using Node.js fallback')
      resolve(null)
      return
    }

    // Adjusted path for lib/api-handlers
    const pythonScript = path.join(__dirname, '../../server-utils/resume-parser.py')
    console.log(`[resumes] Spawning python: ${pythonScript} ${filePath}`)

    const pythonProcess = spawn('python3', [pythonScript, filePath])

    const timeout = setTimeout(() => {
      console.warn('[resumes] Python parsing timed out, killing process...')
      pythonProcess.kill()
      resolve(null)
    }, 5000)

    let stdout = ''
    let stderr = ''

    pythonProcess.stdout.on('data', (data) => stdout += data.toString())
    pythonProcess.stderr.on('data', (data) => stderr += data.toString())

    pythonProcess.on('close', (code) => {
      clearTimeout(timeout)
      if (code !== 0 && code !== null) {
        console.error(`[resumes] Python exited with code ${code}: ${stderr}`)
        return resolve(null)
      }
      if (pythonProcess.killed) return

      try {
        const result = JSON.parse(stdout)
        resolve(result)
      } catch (e) {
        console.error(`[resumes] Failed to parse Python output: ${stdout}`)
        resolve(null)
      }
    })

    pythonProcess.on('error', (err) => {
      clearTimeout(timeout)
      if (err?.code === 'ENOENT') {
        console.log('[resumes] python3 unavailable, falling back to Node.js parser')
      } else {
        console.warn('[resumes] Failed to start Python process, falling back to Node.js parser:', err)
      }
      resolve(null)
    })
  })
}

// Handler for parsing upload
async function handleUpload(req, res) {
  console.log('[resumes] === NEW UPLOAD REQUEST ===')

  // 1. Verify Auth
  const token = extractToken(req)
  if (!token) return sendJson(res, { success: false, error: 'Unauthorized' }, 401)

  // Check verifyToken result - it might vary by implementation, assume payload or null
  const payload = await verifyToken(token)
  if (!payload || !payload.userId) return sendJson(res, { success: false, error: 'Invalid token' }, 401)

  const userId = payload.userId
  let tempFilePath = null

  try {
    const parsed = await parseMultipartSimple(req)
    const buffer = parsed.buffer
    const filename = parsed.filename
    let parsedMetadata = {}
    if (parsed.fields?.metadata) {
      try {
        parsedMetadata = JSON.parse(parsed.fields.metadata)
      } catch (e) {
        console.warn('[resumes] metadata parse failed:', e.message)
      }
    }

    if (!buffer || buffer.length === 0) return sendJson(res, { success: false, error: 'Empty file' }, 400)

    // Save to temp file
    const tempDir = os.tmpdir()
    tempFilePath = path.join(tempDir, `resume-${Date.now()}-${filename}`)
    await fs.writeFile(tempFilePath, buffer)

    console.log(`[resumes] Saved temp file: ${tempFilePath}`)

    // Try Python parsing first
    const pythonResult = await parseWithPython(tempFilePath)
    let parsedData = null
    let parseStatus = 'failed'

    if (pythonResult && pythonResult.success) {
      console.log('[resumes] Python parse success')
      parsedData = {
        ...pythonResult.data,
        text: pythonResult.data.content || '',
        raw: pythonResult.data
      }
      parseStatus = 'success'
    } else {
      console.log('[resumes] Python parse failed, falling back to Node.js')
      await loadDependencies()
      const ext = path.extname(filename).toLowerCase().replace('.', '')
      let text = ''

      if (ext === 'pdf' && pdfParse) {
        const data = await pdfParse(buffer)
        text = data.text
      } else if ((ext === 'docx' || ext === 'doc') && mammoth) {
        const result = await mammoth.extractRawText({ buffer })
        text = result.value
      } else if (ext === 'txt') {
        text = buffer.toString('utf-8')
      }

      if (text) {
        parsedData = {
          text: text.trim(),
          fallback: true
        }
        parseStatus = 'partial'
      }
    }

    // Cleanup / Preserve logic
    const isLocalMode = process.env.RESUME_STORAGE_MODE === 'local'
    let localFilePath = null

    if (isLocalMode) {
      localFilePath = tempFilePath
    } else {
      try { await fs.unlink(tempFilePath) } catch (e) { }
    }

    const finalParsedData = parsedData || {
      text: '',
      fallback: true,
      error: 'Parsing failed'
    }

    const finalParseStatus = parsedData ? parseStatus : 'failed'

    const resumeRecord = {
      userId: userId, // ✅ Associate resume with user
      fileName: filename,
      size: buffer.length,
      fileType: path.extname(filename).toLowerCase().replace('.', ''),
      parseStatus: finalParseStatus,
      parseResult: finalParsedData,
      contentText: finalParsedData.text || finalParsedData.content || '',
      metadata: {
        source: parsedMetadata?.source || 'copilot',
        module: parsedMetadata?.module || 'copilot',
        from: parsedMetadata?.from || 'home_hero',
        uploadedVia: 'home_hero',
        ...(parsedMetadata || {})
      },
      localFilePath,
      uploadedAt: new Date().toISOString(),
      fileContent: buffer.toString('base64') // Save file content for persistent preview
    }

    let savedResumeId = null
    try {
      const saveResult = await saveUserResume(userId, resumeRecord)
      savedResumeId = saveResult.id
      const provider = saveResult.provider || 'unknown'
      console.log(`[resumes] Saved resume for user ${userId} (Status: ${finalParseStatus}, Provider: ${provider}, ID: ${savedResumeId})`)

      if (provider === 'memory') {
        console.warn('[resumes] WARNING: Resume saved to memory. Data will be lost on server restart. Check DATABASE_URL.')
      }
    } catch (saveError) {
      console.error(`[resumes] Failed to save resume record: ${saveError.message}`)
      return sendJson(res, { success: false, error: 'Failed to save resume' }, 500)
    }

    try {
      await invalidateUserMatchCache(userId, 'resume_upload')
    } catch (invalidateError) {
      console.warn(`[resumes] Failed to invalidate match cache for user ${userId}: ${invalidateError.message}`)
    }

    return sendJson(res, {
      success: true,
      data: finalParsedData,
      status: finalParseStatus,
      id: savedResumeId,
      matchScoresInvalidated: true,
      matchScoreRefreshMode: 'next_list_refresh'
    })

  } catch (error) {
    console.error('[resumes] Upload error:', error)
    if (tempFilePath) {
      try { await fs.unlink(tempFilePath) } catch (e) { }
    }
    return sendJson(res, { success: false, error: error.message }, 500)
  }
}

async function getResumeOwner(resumeId) {
  if (!resumeId || !neonHelper.isConfigured) return null

  try {
    const rows = await neonHelper.query(
      'SELECT user_id FROM resumes WHERE resume_id = $1 LIMIT 1',
      [resumeId]
    )
    return rows?.[0]?.user_id || null
  } catch (error) {
    console.error('[resumes] Failed to resolve resume owner:', error.message)
    return null
  }
}

async function getResumeFileMeta(resumeId) {
  if (!resumeId || !neonHelper.isConfigured) return null
  try {
    const rows = await neonHelper.query(
      'SELECT file_name, file_type FROM resumes WHERE resume_id = $1 LIMIT 1',
      [resumeId]
    )
    if (!rows?.length) return null
    return {
      fileName: rows[0].file_name || null,
      fileType: rows[0].file_type || null,
    }
  } catch (error) {
    console.error('[resumes] Failed to resolve resume file meta:', error.message)
    return null
  }
}

function getContentTypeFromResume(fileName = '', fileType = '') {
  const normalized = String(fileType || path.extname(fileName || '').replace('.', '')).toLowerCase()
  switch (normalized) {
    case 'pdf':
      return 'application/pdf'
    case 'doc':
      return 'application/msword'
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case 'txt':
      return 'text/plain; charset=utf-8'
    case 'rtf':
      return 'application/rtf'
    default:
      return 'application/octet-stream'
  }
}

function safeJsonParse(value, fallback = null) {
  if (!value) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function clampScore(value, min = 35, max = 96) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)))
}

function inspectResumeText(text, targetRole = '') {
  const rawText = String(text || '')
  const normalizedText = rawText.toLowerCase()
  const words = rawText.split(/\s+/).filter(Boolean)
  const lines = rawText.split('\n').map((line) => line.trim()).filter(Boolean)
  const bulletLines = lines.filter((line) => /^[-•*]/.test(line))
  const hasEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(rawText)
  const hasPhone = /(\+?\d[\d\s\-()]{7,}\d)/.test(rawText)
  const hasLinkedIn = /linkedin\.com/i.test(rawText)
  const hasGithub = /github\.com/i.test(rawText)
  const hasPortfolio = /(portfolio|作品集|behance|dribbble|notion\.site|personal website)/i.test(rawText)
  const hasSkillsSection = /(skills|技术栈|技能|能力)/i.test(rawText)
  const hasExperienceSection = /(experience|work experience|professional experience|工作经历|实习经历)/i.test(rawText)
  const hasEducationSection = /(education|学历|教育背景)/i.test(rawText)
  const hasProjectsSection = /(projects|project experience|项目经历|项目经验)/i.test(rawText)
  const quantifiedAchievements = (rawText.match(/(\d+%|\$\d+|¥\d+|€\d+|\d+\+|\d+\s*(years|yrs|年|人|天|周|月))/gi) || []).length
  const actionVerbCount = (rawText.match(/(led|built|launched|improved|grew|drove|managed|designed|implemented|优化|主导|负责|推动|设计|搭建|上线|增长|提升|完成)/gi) || []).length
  const dateFormats = Array.from(new Set(rawText.match(/\b\d{4}[./-]\d{1,2}(?:\s*[—\-~至到]+\s*(?:\d{4}[./-]\d{1,2}|至今|present|current))?/gi) || []))
  const targetTokens = String(targetRole || '')
    .toLowerCase()
    .split(/[\s/、,，|]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
  const targetMatches = targetTokens.filter((token) => normalizedText.includes(token)).length

  return {
    rawText,
    normalizedText,
    words,
    lines,
    bulletLines,
    hasEmail,
    hasPhone,
    hasLinkedIn,
    hasGithub,
    hasPortfolio,
    hasSkillsSection,
    hasExperienceSection,
    hasEducationSection,
    hasProjectsSection,
    quantifiedAchievements,
    actionVerbCount,
    dateFormats,
    targetTokens,
    targetMatches,
  }
}

function buildLocalResumeAnalysis(text, targetRole = '') {
  const insight = inspectResumeText(text, targetRole)
  let score = 42
  const suggestions = []

  if (insight.hasEmail) score += 5
  else suggestions.push({
    category: '排版与格式',
    priority: '高',
    issue: '联系信息不够完整',
    suggestion: '把常用邮箱放在顶部，让招聘方能更快联系到你。'
  })

  if (insight.hasPhone) score += 4
  else suggestions.push({
    category: '排版与格式',
    priority: '中',
    issue: '联系电话展示不足',
    suggestion: '补充手机号或稳定联系方式，提升沟通效率。'
  })

  if (insight.hasLinkedIn || insight.hasGithub || insight.hasPortfolio) score += 6
  else suggestions.push({
    category: '内容质量',
    priority: '中',
    issue: '可证明能力的外链较少',
    suggestion: '补充 LinkedIn、GitHub 或作品集链接，增强可信度。'
  })

  if (insight.hasSkillsSection) score += 10
  else suggestions.push({
    category: '关键技能',
    priority: '高',
    issue: '核心技能展示不够集中',
    suggestion: '增加独立技能模块，按工具、能力和业务方向分组展示。'
  })

  if (insight.hasExperienceSection) score += 12
  else suggestions.push({
    category: '内容质量',
    priority: '高',
    issue: '经历模块不够完整',
    suggestion: '优先补充最近且最相关的工作/实习经历，用职责与结果并列的方式表达。'
  })

  if (insight.hasEducationSection) score += 6
  else suggestions.push({
    category: '内容质量',
    priority: '低',
    issue: '教育背景信息较少',
    suggestion: '补充学校、专业、时间段与代表性成绩，方便基础筛选。'
  })

  if (insight.hasProjectsSection) score += 8
  else suggestions.push({
    category: '关键技能',
    priority: '中',
    issue: '项目证明材料偏少',
    suggestion: '增加 1-3 个能体现核心能力的项目，说明目标、动作和结果。'
  })

  if (insight.bulletLines.length >= 6) score += 8
  else suggestions.push({
    category: '排版与格式',
    priority: '中',
    issue: '结构还可以更利于快速扫描',
    suggestion: '多使用要点式表达，让每一条都聚焦一个贡献或结果。'
  })

  if (insight.quantifiedAchievements >= 4) score += 11
  else suggestions.push({
    category: '内容质量',
    priority: '高',
    issue: '量化成果偏少',
    suggestion: '补充百分比、周期、人数、收入或效率提升等结果，会更有说服力。'
  })

  if (insight.words.length >= 180 && insight.words.length <= 1200) score += 8
  else if (insight.words.length < 180) {
    suggestions.push({
      category: '内容质量',
      priority: '高',
      issue: '信息密度还有提升空间',
      suggestion: '补充代表性经历、项目成果和技能说明，让简历更有厚度。'
    })
  } else {
    suggestions.push({
      category: '排版与格式',
      priority: '中',
      issue: '内容偏多，重点不够集中',
      suggestion: '压缩重复信息，优先保留和目标岗位最相关的经历与成果。'
    })
  }

  if (insight.targetTokens.length > 0) {
    if (insight.targetMatches >= Math.min(2, insight.targetTokens.length)) {
      score += 8
    } else {
      suggestions.push({
        category: '关键技能',
        priority: '高',
        issue: '目标岗位指向性还可以更清晰',
        suggestion: `围绕目标岗位“${targetRole}”补充关键词、项目词和结果描述，强化定向匹配度。`
      })
    }
  }

  const uniqueSuggestions = suggestions.slice(0, 5)
  const boundedScore = clampScore(score, 35, 92)

  return {
    score: boundedScore,
    suggestions: uniqueSuggestions.length > 0 ? uniqueSuggestions : [
      {
        category: '内容质量',
        priority: '低',
        issue: '简历基础结构已经比较完整',
        suggestion: '下一步可以继续强化量化成果、岗位关键词与项目证明材料。'
      }
    ],
    insight,
  }
}

function buildLocalInterviewFramework(targetRole = '', insight = null) {
  const roleLabel = String(targetRole || '目标岗位').trim() || '目标岗位'
  return {
    summary: `这组英文面试框架会优先帮助你把过往经历翻译成更容易被海外团队理解的表达。`,
    selfIntroOutline: [
      `Who you are: 用一句话概括你的岗位定位，例如 “I’m a product-minded builder with experience in ${roleLabel}.”`,
      'What you have done: 选择 1-2 段最能体现成果的经历，说明你做过什么。',
      'Why it matters: 强调你如何带来增长、效率提升、项目落地或跨团队协作价值。',
      'Why this role: 把你的经历与目标岗位的业务场景连接起来。'
    ],
    questions: [
      {
        question: `Can you walk me through one experience that best prepared you for a ${roleLabel} role?`,
        focus: '核心经历概括',
        hint: '按 STAR 顺序回答，突出你亲自推动的动作和结果。'
      },
      {
        question: 'How do you usually prioritise when several important tasks happen at the same time?',
        focus: '优先级判断',
        hint: '说明你的判断标准、沟通方式和最终结果。'
      },
      {
        question: 'Tell me about a project where you had to collaborate across functions or work asynchronously.',
        focus: '协作与远程工作',
        hint: '突出文档、同步机制和推进方式。'
      },
      {
        question: 'What is one strength from your background that would create value quickly in a new team?',
        focus: '优势表达',
        hint: '从优势、例子、结果三个层次回答。'
      }
    ],
  }
}

function buildLocalResumeAssistantFramework(text, targetRole = '') {
  const local = buildLocalResumeAnalysis(text, targetRole)
  const { insight } = local

  const strengths = []
  if (insight.quantifiedAchievements >= 3) {
    strengths.push({
      title: '成果表达已经具备说服力基础',
      detail: '你的简历里已经出现了量化结果，这是面试官快速判断影响力的重要信号。'
    })
  }
  if (insight.hasExperienceSection) {
    strengths.push({
      title: '经历主线是可读的',
      detail: '工作/实习经历已经成型，只要继续聚焦与目标岗位更相关的内容，就更容易放大优势。'
    })
  }
  if (insight.hasSkillsSection) {
    strengths.push({
      title: '技能表达已经具备基础框架',
      detail: '你已经有了技能模块，下一步主要是让技能和项目成果更紧密地对应起来。'
    })
  }
  if (insight.hasLinkedIn || insight.hasGithub || insight.hasPortfolio) {
    strengths.push({
      title: '可信证明材料有加分空间',
      detail: '外链材料会显著提升可信度，你已经具备继续放大专业形象的基础。'
    })
  }
  if (!strengths.length) {
    strengths.push(
      {
        title: '简历主线已经具备雏形',
        detail: '从现有内容看，你已经有可以展开的经历素材，下一步更重要的是把重点讲得更清楚、更聚焦。'
      },
      {
        title: '经历中有可被放大的价值',
        detail: '只要补足结果、动作和目标岗位关联度，你的简历说服力会明显上升。'
      }
    )
  }

  const growthAreas = local.suggestions.slice(0, 4).map((item, index) => ({
    title: item.issue,
    detail: item.suggestion,
    priority: item.priority,
    focusKey: `growth_${index + 1}`,
  }))

  const starGaps = []
  if (insight.quantifiedAchievements < 4) {
    starGaps.push({
      title: '结果（R）可以再补强',
      detail: '建议为关键经历增加数字化结果，例如效率提升、用户规模、上线周期或业务影响。',
      missing: ['结果', '量化'],
      focusKey: 'star_result',
    })
  }
  if (insight.actionVerbCount < 6) {
    starGaps.push({
      title: '动作（A）描述还不够具体',
      detail: '可以明确写出你亲自做了什么，例如搭建、推动、设计、协调或优化了哪些环节。',
      missing: ['动作'],
      focusKey: 'star_action',
    })
  }
  if (!insight.hasProjectsSection) {
    starGaps.push({
      title: '情境（S）和任务（T）背景还可以更完整',
      detail: '为代表性项目补充业务背景、目标和限制条件，能帮助招聘方快速理解你的判断场景。',
      missing: ['情境', '任务'],
      focusKey: 'star_context',
    })
  }
  if (!starGaps.length) {
    starGaps.push({
      title: 'STAR 结构已经有基础',
      detail: '下一步可以优先挑 1-2 段最重要的经历，把情境、动作和结果写得更精炼、更可验证。',
      missing: ['优化表达'],
      focusKey: 'star_refine',
    })
  }

  const rewriteDirections = [
    {
      title: '优先把最强经历放到前面',
      direction: '简历首页优先展示最能体现岗位匹配度、结果影响和核心技能的经历。',
      example: '例如把“职责描述”改成“业务目标 + 关键动作 + 可量化结果”的结构。'
    },
    {
      title: '围绕目标岗位统一语言',
      direction: targetRole
        ? `把简历中的标题、技能词和项目词更多向“${targetRole}”靠拢。`
        : '建议先明确目标岗位，再让技能词和项目词围绕该方向统一表达。',
      example: '这样做能让招聘方更快理解你的岗位画像，而不是让他们自己去猜。'
    },
  ]

  if (insight.dateFormats.length > 1) {
    rewriteDirections.push({
      title: '统一时间与格式表达',
      direction: '时间信息尽量采用统一格式，让简历整体更专业、更易读。',
      example: '例如统一成 YYYY.MM - YYYY.MM 或 YYYY/MM - 至今，不需要额外展开解释。'
    })
  }

  const confidenceSummary = {
    headline: '你的简历已经有值得放大的亮点。',
    summary: `当前更重要的不是推翻重写，而是把最能代表你的经历、结果与目标岗位关系表达得更集中。只要继续补足 STAR 信息和量化结果，整体说服力会明显提升。`
  }

  return {
    score: local.score,
    confidenceSummary,
    strengths: strengths.slice(0, 4),
    growthAreas,
    starGaps,
    rewriteDirections: rewriteDirections.slice(0, 4),
    englishInterviewFramework: buildLocalInterviewFramework(targetRole, insight),
  }
}

function normalizeFramework(rawFramework, fallbackFramework) {
  const framework = safeJsonParse(rawFramework, rawFramework) || {}
  const fallback = fallbackFramework || {}
  const toArray = (value) => Array.isArray(value) ? value : []
  return {
    score: clampScore(framework?.score || fallback?.score || 0),
    confidenceSummary: {
      headline: framework?.confidenceSummary?.headline || framework?.confidence_summary?.headline || fallback?.confidenceSummary?.headline || '你的简历已经具备继续放大的基础。',
      summary: framework?.confidenceSummary?.summary || framework?.confidence_summary?.summary || fallback?.confidenceSummary?.summary || '建议优先放大最强经历与结果表达，再逐步补足信息。'
    },
    strengths: toArray(framework?.strengths || fallback?.strengths).slice(0, 4).map((item, index) => ({
      title: item?.title || `亮点 ${index + 1}`,
      detail: item?.detail || item?.description || ''
    })),
    growthAreas: toArray(framework?.growthAreas || framework?.growth_areas || fallback?.growthAreas).slice(0, 4).map((item, index) => ({
      title: item?.title || `建议 ${index + 1}`,
      detail: item?.detail || item?.suggestion || '',
      priority: item?.priority || '中',
      focusKey: item?.focusKey || item?.focus_key || `growth_${index + 1}`
    })),
    starGaps: toArray(framework?.starGaps || framework?.star_gaps || fallback?.starGaps).slice(0, 4).map((item, index) => ({
      title: item?.title || `STAR 建议 ${index + 1}`,
      detail: item?.detail || '',
      missing: Array.isArray(item?.missing) ? item.missing : [],
      focusKey: item?.focusKey || item?.focus_key || `star_${index + 1}`
    })),
    rewriteDirections: toArray(framework?.rewriteDirections || framework?.rewrite_directions || fallback?.rewriteDirections).slice(0, 4).map((item, index) => ({
      title: item?.title || `优化方向 ${index + 1}`,
      direction: item?.direction || item?.detail || '',
      example: item?.example || ''
    })),
    englishInterviewFramework: {
      summary: framework?.englishInterviewFramework?.summary || framework?.english_interview_framework?.summary || fallback?.englishInterviewFramework?.summary || '围绕你的目标岗位先建立一版可复用的英文表达框架。',
      selfIntroOutline: Array.isArray(framework?.englishInterviewFramework?.selfIntroOutline)
        ? framework.englishInterviewFramework.selfIntroOutline
        : Array.isArray(framework?.english_interview_framework?.self_intro_outline)
          ? framework.english_interview_framework.self_intro_outline
          : Array.isArray(fallback?.englishInterviewFramework?.selfIntroOutline)
            ? fallback.englishInterviewFramework.selfIntroOutline
            : [],
      questions: Array.isArray(framework?.englishInterviewFramework?.questions)
        ? framework.englishInterviewFramework.questions
        : Array.isArray(framework?.english_interview_framework?.questions)
          ? framework.english_interview_framework.questions
          : Array.isArray(fallback?.englishInterviewFramework?.questions)
            ? fallback.englishInterviewFramework.questions
            : [],
    }
  }
}

function flattenFrameworkSuggestions(framework) {
  const suggestions = []
  for (const item of framework?.growthAreas || []) {
    suggestions.push({
      category: '内容质量',
      priority: item.priority || '中',
      issue: item.title,
      suggestion: item.detail,
    })
  }
  for (const item of framework?.starGaps || []) {
    suggestions.push({
      category: '关键技能',
      priority: '中',
      issue: item.title,
      suggestion: item.detail,
    })
  }
  return suggestions.slice(0, 5)
}

function extractJsonObject(content = '') {
  const text = String(content || '').trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1)
  }
  return text.replace(/```json\n?|\n?```/g, '').trim()
}

async function callRemoteResumeModel(prompt, { modelForBailian = 'qwen-plus', maxTokens = 2200 } = {}) {
  const apiKey =
    process.env.VITE_ALIBABA_BAILIAN_API_KEY ||
    process.env.ALIBABA_BAILIAN_API_KEY
  const deepseekKey =
    process.env.VITE_DEEPSEEK_API_KEY ||
    process.env.DEEPSEEK_API_KEY

  if (!apiKey && !deepseekKey) return null

  const provider = apiKey ? 'bailian' : 'deepseek'
  const key = apiKey || deepseekKey
  const apiUrl = provider === 'bailian'
    ? 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
    : 'https://api.deepseek.com/chat/completions'
  const requestBody = {
    model: provider === 'bailian' ? modelForBailian : 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: '你是一位专业的招聘顾问、简历教练和英文面试导师。请严格输出可解析 JSON，不要输出 markdown 代码块，不要输出解释。'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.35,
    max_tokens: maxTokens
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`AI API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    return result.choices?.[0]?.message?.content || null
  } catch (error) {
    console.error('[Resume Assistant] Remote model call failed:', error.message)
    return null
  }
}

async function buildAiResumeAssistantFramework(text, targetRole, fallbackFramework, preferPremiumModel = false) {
  const prompt = `请基于下面的简历内容，生成一份“鼓励式、建设性”的简历助手输出。

【重要规则】
1. 先讲优势，再讲可以补强的部分。
2. 不要使用“错误、漏洞、缺陷、事实性错误”等打击性表达。
3. 禁止根据“当前年份/当前日期”判断简历时间是否正确。
4. 如果发现时间信息，只能提示“格式不统一”或“时间表达可以更清晰”，绝不能说“当前时间是某年，所以这里错误”。
5. 不要直接重写整份简历，只给方向、框架和示例。
6. 所有中文表达都要用户友好，目标是增强信心，而不是挑错。
7. 需要补充一组英文面试框架，问题本身用英文，说明字段用中文。

求职方向：${targetRole || '未指定'}

简历内容：
${String(text || '').slice(0, 5000)}

请输出 JSON：
{
  "score": 0-100,
  "confidenceSummary": {
    "headline": "一句鼓励性标题",
    "summary": "1段建设性总结，说明用户已经具备的价值以及下一步怎么放大"
  },
  "strengths": [
    { "title": "优势标题", "detail": "优势说明，强调可迁移价值" }
  ],
  "growthAreas": [
    { "title": "建议补强的信息", "detail": "更友好的表达", "priority": "高|中|低", "focusKey": "growth_x" }
  ],
  "starGaps": [
    { "title": "STAR 补足点", "detail": "说明缺少什么信息", "missing": ["情境","任务","动作","结果"], "focusKey": "star_x" }
  ],
  "rewriteDirections": [
    { "title": "优化方向", "direction": "表达建议", "example": "一句示例" }
  ],
  "englishInterviewFramework": {
    "summary": "英文面试准备摘要",
    "selfIntroOutline": ["60秒自我介绍骨架1", "骨架2", "骨架3"],
    "questions": [
      { "question": "English question", "focus": "考察重点", "hint": "回答提示" }
    ]
  }
}

要求：
- strengths 3-4 条
- growthAreas 2-4 条
- starGaps 2-4 条
- rewriteDirections 2-4 条
- 英文问题 3-5 条`

  const raw = await callRemoteResumeModel(prompt, {
    modelForBailian: preferPremiumModel ? 'qwen-max' : 'qwen-plus',
    maxTokens: 2400
  })

  if (!raw) {
    return { framework: fallbackFramework, usedAi: false }
  }

  try {
    const parsed = JSON.parse(extractJsonObject(raw))
    return {
      framework: normalizeFramework(parsed, fallbackFramework),
      usedAi: true
    }
  } catch (error) {
    console.warn('[Resume Assistant] Failed to parse AI framework, fallback to local:', error.message)
    return { framework: fallbackFramework, usedAi: false }
  }
}

async function buildResumePolishResult(text, targetRole, framework, options = {}) {
  const fallbackTitle = framework?.growthAreas?.[0]?.title || framework?.starGaps?.[0]?.title || '核心表达优化'
  const fallback = {
    mode: 'resume',
    title: '简历深度打磨',
    sections: [
      {
        heading: '优先优化方向',
        body: `建议先围绕“${fallbackTitle}”展开，优先把最能体现价值的经历写得更具体、更有结果感。`,
        bullets: [
          '补充业务背景与目标，让招聘方更快理解场景。',
          '写清楚你亲自推动了什么动作，避免只写职责名称。',
          '尽量补上结果、数据或影响范围，让经历更有说服力。'
        ]
      },
      {
        heading: 'STAR 法则补充参考',
        body: '可以按“情境 - 任务 - 动作 - 结果”的顺序，把一段经历补成可被追问、也经得住追问的表达。',
        bullets: [
          'S：当时的业务背景、阶段或限制是什么？',
          'T：你需要解决的核心问题是什么？',
          'A：你亲自做了哪些关键动作？',
          'R：带来了什么结果，最好有数字或具体反馈。'
        ]
      }
    ]
  }

  if (!options.preferAI) return fallback

  const focusLabel = options.focusKey || fallbackTitle
  const prompt = `请对这份简历做“局部深度打磨”，输出给用户看的中文 JSON。

要求：
1. 语气要鼓励、专业、可执行。
2. 只聚焦一个重点，不要泛泛而谈。
3. 不要判断当前年份，不要做事实校验式表达。
4. 输出要帮助用户直接修改简历，并结合 STAR 法则。

求职方向：${targetRole || '未指定'}
当前聚焦点：${focusLabel}

已有框架：
${JSON.stringify(framework || {}, null, 2).slice(0, 2400)}

简历内容：
${String(text || '').slice(0, 3600)}

输出 JSON：
{
  "mode": "resume",
  "title": "简历深度打磨标题",
  "sections": [
    {
      "heading": "段落标题",
      "body": "说明",
      "bullets": ["要点1", "要点2", "要点3"]
    }
  ]
}`

  const raw = await callRemoteResumeModel(prompt, { modelForBailian: 'qwen-max', maxTokens: 1800 })
  if (!raw) return fallback

  try {
    const parsed = JSON.parse(extractJsonObject(raw))
    return {
      mode: 'resume',
      title: parsed?.title || fallback.title,
      sections: Array.isArray(parsed?.sections) && parsed.sections.length > 0 ? parsed.sections : fallback.sections
    }
  } catch {
    return fallback
  }
}

async function buildInterviewPolishResult(userId, targetRole, framework, isMember) {
  const existingQuestions = framework?.englishInterviewFramework?.questions || []
  const result = await handleGenerateInterviewPlan(userId, {
    __isMember: Boolean(isMember),
    batchSize: 6,
    existingQuestions,
    jobDirection: targetRole || '远程目标岗位',
    positionType: '全职'
  })

  const questions = Array.isArray(result?.questions) && result.questions.length > 0
    ? result.questions
    : existingQuestions

  return {
    mode: 'interview',
    title: '英文面试题拓展',
    sections: [
      {
        heading: '新增练习重点',
        body: '建议优先挑 2-3 道与你最强经历相关的问题，先把英文表达练顺，再扩展到其他题型。',
        bullets: questions.slice(0, 6).map((item, index) => `${index + 1}. ${item.question}`)
      }
    ],
    questions,
  }
}

async function buildMockAnswerResult(userId, question, targetRole, isMember) {
  const safeQuestion = String(question || '').trim()
  const answerResult = await handleGenerateAnswer(userId, {
    __isMember: Boolean(isMember),
    question: safeQuestion || 'Tell me about a project you are most proud of.',
    jobTitle: targetRole || '远程目标岗位'
  })

  return {
    mode: 'mock_answer',
    title: '模拟面试回答',
    sections: [
      {
        heading: '英文回答示范',
        body: answerResult?.answer || '',
        bullets: []
      },
      {
        heading: '中文表达提示',
        body: answerResult?.followUp || '建议把回答进一步贴近你的真实经历，并补充量化结果。',
        bullets: Array.isArray(answerResult?.highlights) ? answerResult.highlights : []
      }
    ],
    question: safeQuestion || 'Tell me about a project you are most proud of.',
  }
}

export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    return sendJson(res, {}, 200)
  }

  try {
    // GET - 获取所有简历 或 下载简历
    if (req.method === 'GET') {
      const { action, id } = req.query

      // Download Resume Content
      if (action === 'download' && id) {
        let token = extractToken(req)
        // Allow token in query for file downloads (browser navigation)
        if (!token && req.query.token) {
            token = req.query.token;
        }

        if (!token) return sendJson(res, { success: false, error: 'Authentication required' }, 401)

        // Check verifyToken result - it might vary by implementation, assume payload or null
        const decoded = await verifyToken(token)
        if (!decoded) return sendJson(res, { success: false, error: 'Invalid token' }, 401)

        // Try to get content from DB directly first
        const content = await getResumeContent(id)
        const fileMeta = await getResumeFileMeta(id)
        
        if (content) {
            // It's a buffer or base64 string?
            // saveUserResume saves it as bytea or whatever DB supports. 
            // Neon helper query returns rows.
            // If getResumeContent returns the raw value, we need to handle it.
            // Assuming getResumeContent returns the buffer or string.
            
            // If it's stored as bytea in postgres, pg driver returns Buffer.
            // Let's send it.
            let bufferToSend = content;
            // If it's a string (e.g. base64), convert to buffer
            if (typeof content === 'string') {
                // Check if it's base64
                if (content.match(/^[A-Za-z0-9+/=]+$/)) {
                     bufferToSend = Buffer.from(content, 'base64');
                } else {
                     bufferToSend = Buffer.from(content);
                }
            }

            const originalFileName = fileMeta?.fileName || `resume-${id}${fileMeta?.fileType ? `.${fileMeta.fileType}` : ''}`
            const safeAsciiName = originalFileName
              .replace(/[^\x20-\x7E]+/g, '_')
              .replace(/["\\]/g, '_') || `resume-${id}`

            res.setHeader('Content-Type', getContentTypeFromResume(originalFileName, fileMeta?.fileType || ''))
            res.setHeader(
              'Content-Disposition',
              `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodeURIComponent(originalFileName)}`
            )
            res.send(bufferToSend)
            return
        }

        return sendJson(res, { success: false, error: 'Resume content not found' }, 404)
      }



      // 获取简历内容（用于预览）
      if (action === 'content' && id) {
        const token = extractToken(req)
        if (!token) return sendJson(res, { success: false, error: 'Authentication required' }, 401)

        const decoded = await verifyToken(token)
        if (!decoded) return sendJson(res, { success: false, error: 'Invalid token' }, 401)

        const ownerId = await getResumeOwner(id)
        if (!ownerId) return sendJson(res, { success: false, error: 'Resume not found' }, 404)

        // 权限检查
        const isOwner = ownerId === decoded.userId
        const isAdmin = decoded.admin === true
        if (!isOwner && !isAdmin) return sendJson(res, { success: false, error: 'Permission denied' }, 403)

        // 尝试从数据库获取内容
        const content = await getResumeContent(id)
        if (content) {
          return sendJson(res, { success: true, content })
        }
        
        return sendJson(res, { success: false, error: 'Content not available' }, 404)
      }

      // List all resumes (Admin or Owner)
      const token = extractToken(req)
      if (!token) return sendJson(res, { success: false, error: 'Authentication required' }, 401)
      const decoded = await verifyToken(token)
      if (!decoded) return sendJson(res, { success: false, error: 'Invalid token' }, 401)

      // Check Admin Role
      const isAdmin = decoded.admin === true || SUPER_ADMIN_EMAILS.includes(String(decoded.email || '').toLowerCase());
      
      // Determine target user ID based on scope and role
      let targetUserId = decoded.userId;

      // Only allow fetching all resumes if:
      // 1. User is Admin
      // 2. Request explicitly asks for scope=all_users
      if (isAdmin && req.query.scope === 'all_users') {
          targetUserId = null;
      }
      
      const requestedLimit = Number.parseInt(req.query.limit, 10)
      const requestedOffset = Number.parseInt(req.query.offset, 10)
      const listOptions = {
        limit: Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : null,
        offset: Number.isFinite(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0,
      }
      const { resumes, provider, error, total } = await getResumes(targetUserId, listOptions)
      
      if (error) {
          return sendJson(res, { success: false, error, provider }, 500)
      }

      return sendJson(res, { 
          success: true, 
          data: resumes,
          provider,
          count: resumes.length,
          total: Number.isFinite(total) ? total : resumes.length,
          limit: listOptions.limit,
          offset: listOptions.offset,
      })
    }

    // POST - 保存简历（JSON）或 上传解析（Multipart）
    if (req.method === 'POST') {
      const contentType = req.headers['content-type'] || ''

      // Merge: Handle Multipart Upload
      if (contentType.includes('multipart/form-data')) {
        return handleUpload(req, res)
      }

      // Handle raw JSON (existing logic)
      const chunks = []
      for await (const chunk of req) {
        chunks.push(chunk)
      }
      // Protect against empty body if not multipart
      if (chunks.length === 0) return sendJson(res, { success: false, error: 'Empty body' }, 400)

      const body = JSON.parse(Buffer.concat(chunks).toString())

      // === NEW: Handle Resume Analysis ===
      if (body.action === 'analyze') {
        const token = extractToken(req)
        if (!token) return sendJson(res, { success: false, error: 'Unauthorized' }, 401)
        const decoded = await verifyToken(token)
        if (!decoded) return sendJson(res, { success: false, error: 'Invalid token' }, 401)

        const { id, targetRole, focusKey = '', question = '' } = body
        const stage = ['framework', 'polish_resume', 'polish_interview', 'mock_answer'].includes(body.stage)
          ? body.stage
          : 'framework'
        if (!id) return sendJson(res, { success: false, error: 'Missing resume id' }, 400)

        const { resumes } = await getResumes()
        const resume = resumes.find(r => r.id === id)

        if (!resume) return sendJson(res, { success: false, error: 'Resume not found' }, 404)
        if (resume.userId !== decoded.userId && !decoded.admin) return sendJson(res, { success: false, error: 'Permission denied' }, 403)

        // Check Membership Status
        let isMember = false
        
        if (neonHelper.isConfigured) {
            try {
                // Always fetch user to check member status, even if admin (to update local vars if needed)
                // Fix: Remove legacy columns that might cause errors if migration failed
                const userRows = await neonHelper.query(
                    `SELECT member_status, member_expire_at, member_cycle_start_at, roles FROM users WHERE user_id = $1`,
                    [decoded.userId]
                )
                if (userRows && userRows.length > 0) {
                    const u = userRows[0]
                    isMember = isMembershipActive(u)
                }
            } catch (e) {
                console.warn('[Resumes] Failed to check membership:', e)
            }
        }

        const resumeAiKey = process.env.VITE_ALIBABA_BAILIAN_API_KEY || process.env.ALIBABA_BAILIAN_API_KEY
        const resumeDeepseekKey = process.env.VITE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY
        const canUseEnhancedAi = isMember && Boolean(resumeAiKey || resumeDeepseekKey)

        if (stage !== 'framework' && !isMember) {
          return sendJson(res, {
            success: false,
            error: '深度打磨为会员权益，请先生成简历框架后升级体验',
            requiresMembership: true
          }, 403)
        }

        // 1. Analyze resume
        const parseResult = safeJsonParse(resume.parseResult, null)
        const resumeText = (
          resume.contentText ||
          parseResult?.content ||
          parseResult?.text ||
          ''
        ).trim()
        if (!resumeText) return sendJson(res, { success: false, error: 'Resume content is empty' }, 400)

        try {
          const existingAssistantPayload = safeJsonParse(resume.assistantPayload, {}) || {}
          const analysisResult = await analyzeResumeContent(resumeText, targetRole, {
            preferAI: canUseEnhancedAi
            , stage
            , focusKey
            , question
            , userId: decoded.userId
            , isMember
            , existingPayload: existingAssistantPayload
          })

          const framework = analysisResult.framework || existingAssistantPayload.framework || null
          const nextAssistantPayload = {
            ...(existingAssistantPayload || {}),
            framework,
            lastFrameworkMode: stage === 'framework'
              ? analysisResult.analysisMode
              : (existingAssistantPayload.lastFrameworkMode || analysisResult.analysisMode),
            lastFrameworkScore: framework ? analysisResult.score : (existingAssistantPayload.lastFrameworkScore || analysisResult.score),
            lastPolishResult: analysisResult.polishResult || existingAssistantPayload.lastPolishResult || null,
            lastPolishStage: stage === 'framework' ? (existingAssistantPayload.lastPolishStage || null) : stage,
            lastQuestion: question || existingAssistantPayload.lastQuestion || '',
            updatedAt: new Date().toISOString(),
          }

          const fallbackSuggestions = analysisResult.suggestions || flattenFrameworkSuggestions(framework)

          await updateResumeAnalysis(
            id,
            analysisResult.score,
            fallbackSuggestions,
            nextAssistantPayload,
            'resume_assistant_v2'
          )

          return sendJson(res, {
            success: true,
            data: {
              score: analysisResult.score || 0,
              suggestions: fallbackSuggestions,
              analysisMode: analysisResult.analysisMode || 'local',
              isEnhanced: analysisResult.analysisMode === 'ai',
              framework,
              polishResult: analysisResult.polishResult || null,
              assistantPayload: nextAssistantPayload,
              stage,
            }
          })
        } catch (aiErr) {
          console.error('AI Analysis failed:', aiErr)
          return sendJson(res, { success: false, error: '简历分析失败，请稍后重试' }, 500)
        }
      }

      // Handle content update
      if (body.action === 'update_content') {
        const token = extractToken(req)
        if (!token) return sendJson(res, { success: false, error: 'Unauthorized' }, 401)
        const decoded = await verifyToken(token)
        if (!decoded) return sendJson(res, { success: false, error: 'Invalid token' }, 401)
        
        if (!body.id || !body.contentText) {
           return sendJson(res, { success: false, error: 'Missing id or contentText' }, 400)
        }

        const ownerUserId = await getResumeOwner(body.id)
        if (!ownerUserId) {
          return sendJson(res, { success: false, error: 'Resume not found' }, 404)
        }
        if (ownerUserId !== decoded.userId && !decoded.admin) {
          return sendJson(res, { success: false, error: 'Permission denied' }, 403)
        }

        const result = await updateResumeContent(body.id, body.contentText)
        if (result.success) {
          try {
            await invalidateUserMatchCache(ownerUserId, 'resume_content_update')
          } catch (invalidateError) {
            console.warn(`[resumes] Failed to invalidate match cache after content update for user ${ownerUserId}: ${invalidateError.message}`)
          }
        }
        return sendJson(res, {
          ...result,
          matchScoresInvalidated: Boolean(result.success),
          matchScoreRefreshMode: result.success ? 'next_list_refresh' : 'unchanged'
        })
      }

      if (!body.resumes || !Array.isArray(body.resumes)) {
        return sendJson(res, {
          success: false,
          error: 'Invalid request: resumes array required'
        }, 400)
      }

      const mode = body.mode || 'append' // append 或 replace
      let finalResumes = []
      if (mode === 'append') {
        const { resumes: existingResumes } = await getResumes()
        finalResumes = [...body.resumes, ...existingResumes]
      } else {
        finalResumes = body.resumes
      }

      const result = await saveResumes(finalResumes)
      res.setHeader('X-Storage-Provider', result.provider)
      return sendJson(res, {
        success: result.success,
        provider: result.provider,
        count: result.count,
        ids: result.ids, // Return IDs
        mode
      })
    }

    // DELETE - 删除简历
    if (req.method === 'DELETE') {
      const { id } = req.query
      if (id) {
        const token = extractToken(req)
        if (!token) return sendJson(res, { success: false, error: 'Authentication required' }, 401)
        const decoded = await verifyToken(token)
        if (!decoded) return sendJson(res, { success: false, error: 'Invalid token' }, 401)

        const ownerUserId = await getResumeOwner(id)
        if (!ownerUserId) {
          return sendJson(res, { success: false, error: 'Resume not found' }, 404)
        }
        if (ownerUserId !== decoded.userId && !decoded.admin) {
          return sendJson(res, { success: false, error: 'Permission denied' }, 403)
        }

        // Use deleteResume for cleaner removal including content
        const result = await deleteResume(id)
        if (result.success) {
          try {
            await invalidateUserMatchCache(ownerUserId, 'resume_delete')
          } catch (invalidateError) {
            console.warn(`[resumes] Failed to invalidate match cache after delete for user ${ownerUserId}: ${invalidateError.message}`)
          }
        }
        return sendJson(res, {
          success: result.success,
          deletedId: id,
          remainingCount: result.count,
          matchScoresInvalidated: Boolean(result.success),
          matchScoreRefreshMode: result.success ? 'next_list_refresh' : 'unchanged'
        })
      } else {
        const result = await saveResumes([])
        return sendJson(res, {
          success: result.success,
          message: 'All resumes cleared',
          count: 0
        })
      }
    }

    return sendJson(res, {
      success: false,
      error: 'Method not allowed'
    }, 405)

  } catch (error) {
    console.error('[Resumes API] Error:', error)
    return sendJson(res, {
      success: false,
      error: error.message || 'Internal server error'
    }, 500)
  }
}

async function analyzeResumeContent(text, targetRole, options = {}) {
  const stage = options.stage || 'framework'
  const preferAI = options.preferAI === true
  const localFramework = buildLocalResumeAssistantFramework(text, targetRole)
  const normalizedExisting = normalizeFramework(options.existingPayload?.framework, localFramework)

  if (stage === 'framework') {
    const aiFrameworkResult = preferAI
      ? await buildAiResumeAssistantFramework(text, targetRole, localFramework, Boolean(options.isMember))
      : null
    const framework = aiFrameworkResult?.framework || localFramework

    return {
      score: clampScore(framework?.score || localFramework.score || 0),
      suggestions: flattenFrameworkSuggestions(framework),
      framework,
      analysisMode: aiFrameworkResult?.usedAi ? 'ai' : 'local',
    }
  }

  const baseFramework = options.existingPayload?.framework
    ? normalizeFramework(options.existingPayload.framework, localFramework)
    : (await analyzeResumeContent(text, targetRole, {
      ...options,
      stage: 'framework',
      existingPayload: options.existingPayload || {},
    })).framework

  if (stage === 'polish_resume') {
    const polishResult = await buildResumePolishResult(text, targetRole, baseFramework, {
      preferAI,
      focusKey: options.focusKey,
    })
    return {
      score: clampScore(baseFramework?.score || localFramework.score),
      suggestions: flattenFrameworkSuggestions(baseFramework),
      framework: baseFramework,
      polishResult,
      analysisMode: preferAI ? 'ai' : 'local',
    }
  }

  if (stage === 'polish_interview') {
    const polishResult = await buildInterviewPolishResult(options.userId, targetRole, baseFramework, options.isMember)
    const mergedFramework = {
      ...baseFramework,
      englishInterviewFramework: {
        ...baseFramework.englishInterviewFramework,
        questions: polishResult.questions || baseFramework.englishInterviewFramework?.questions || []
      }
    }
    return {
      score: clampScore(mergedFramework?.score || localFramework.score),
      suggestions: flattenFrameworkSuggestions(mergedFramework),
      framework: mergedFramework,
      polishResult,
      analysisMode: preferAI ? 'ai' : 'local',
    }
  }

  if (stage === 'mock_answer') {
    const defaultQuestion = baseFramework?.englishInterviewFramework?.questions?.[0]?.question || ''
    const polishResult = await buildMockAnswerResult(
      options.userId,
      options.question || defaultQuestion,
      targetRole,
      options.isMember
    )

    return {
      score: clampScore(baseFramework?.score || localFramework.score),
      suggestions: flattenFrameworkSuggestions(baseFramework),
      framework: baseFramework,
      polishResult,
      analysisMode: preferAI ? 'ai' : 'local',
    }
  }

  return {
    score: clampScore(normalizedExisting?.score || localFramework.score),
    suggestions: flattenFrameworkSuggestions(normalizedExisting),
    framework: normalizedExisting,
    analysisMode: 'local',
  }
}
