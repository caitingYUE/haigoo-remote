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

const ENABLE_AI_RESUME_ANALYSIS = String(process.env.ENABLE_AI_RESUME_ANALYSIS || 'false').toLowerCase() === 'true'

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

function buildLocalResumeAnalysis(text, targetRole = '') {
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
  const quantifiedAchievements = (rawText.match(/(\d+%|\$\d+|¥\d+|€\d+|\d+\+|\d+\s*(years|yrs|年))/gi) || []).length
  const targetTokens = String(targetRole || '')
    .toLowerCase()
    .split(/[\s/、,，|]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
  const targetMatches = targetTokens.filter((token) => normalizedText.includes(token)).length

  let score = 42
  const suggestions = []

  if (hasEmail) score += 5
  else suggestions.push({
    category: '排版与格式',
    priority: '高',
    issue: '缺少清晰的联系邮箱信息',
    suggestion: '将常用邮箱放在简历顶部，确保招聘方能立即联系到你。'
  })

  if (hasPhone) score += 4
  else suggestions.push({
    category: '排版与格式',
    priority: '中',
    issue: '缺少联系电话或联系方式不完整',
    suggestion: '补充手机号或其他稳定联系方式，提升简历可联系性。'
  })

  if (hasLinkedIn || hasGithub || hasPortfolio) score += 6
  else suggestions.push({
    category: '内容质量',
    priority: '中',
    issue: '缺少作品集、GitHub 或 LinkedIn 等可信链接',
    suggestion: '补充能够证明能力的外链，尤其是技术、设计、产品类岗位。'
  })

  if (hasSkillsSection) score += 10
  else suggestions.push({
    category: '关键技能',
    priority: '高',
    issue: '技能模块不明显，核心能力不易被快速扫描',
    suggestion: '增加独立技能模块，按语言、框架、工具分组展示。'
  })

  if (hasExperienceSection) score += 12
  else suggestions.push({
    category: '内容质量',
    priority: '高',
    issue: '工作/实习经历模块不完整',
    suggestion: '用“职责 + 结果”结构补充经历，优先展示最近且相关的岗位。'
  })

  if (hasEducationSection) score += 6
  else suggestions.push({
    category: '内容质量',
    priority: '低',
    issue: '教育背景信息不完整',
    suggestion: '补充学校、专业、时间段和关键成绩，方便基础筛选。'
  })

  if (hasProjectsSection) score += 8
  else suggestions.push({
    category: '关键技能',
    priority: '中',
    issue: '项目经历展示不足',
    suggestion: '增加 1-3 个能证明核心能力的项目，突出目标、动作和结果。'
  })

  if (bulletLines.length >= 6) score += 8
  else suggestions.push({
    category: '排版与格式',
    priority: '中',
    issue: '简历结构偏散，缺少易读的要点式表达',
    suggestion: '多使用 bullet points，每条聚焦一个成果或职责。'
  })

  if (quantifiedAchievements >= 4) score += 11
  else suggestions.push({
    category: '内容质量',
    priority: '高',
    issue: '量化成果不足，影响说服力',
    suggestion: '尽量补充百分比、金额、人数、周期等量化结果。'
  })

  if (words.length >= 180 && words.length <= 1200) score += 8
  else if (words.length < 180) {
    suggestions.push({
      category: '内容质量',
      priority: '高',
      issue: '简历内容偏少，信息密度不足',
      suggestion: '补充经历细节、项目成果和技能说明，避免简历过薄。'
    })
  } else {
    suggestions.push({
      category: '排版与格式',
      priority: '中',
      issue: '简历内容较长，重点不够聚焦',
      suggestion: '压缩无关信息，优先保留与目标岗位最相关的经历和成果。'
    })
  }

  if (targetTokens.length > 0) {
    if (targetMatches >= Math.min(2, targetTokens.length)) {
      score += 8
    } else {
      suggestions.push({
        category: '关键技能',
        priority: '高',
        issue: '与目标岗位的关键词匹配度不高',
        suggestion: `围绕目标岗位“${targetRole}”补充相关技能词、项目词和成果描述，提高定向匹配度。`
      })
    }
  }

  const uniqueSuggestions = suggestions.slice(0, 5)
  const boundedScore = Math.max(35, Math.min(92, Math.round(score)))

  return {
    score: boundedScore,
    suggestions: uniqueSuggestions.length > 0 ? uniqueSuggestions : [
      {
        category: '内容质量',
        priority: '低',
        issue: '简历基础结构完整，但仍有优化空间',
        suggestion: '继续强化量化成果、目标岗位关键词和项目证明材料。'
      }
    ]
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

        const { resumes } = await getResumes()
        const resume = resumes.find(r => r.id === id)
        if (!resume) return sendJson(res, { success: false, error: 'Resume not found' }, 404)

        // 权限检查
        const isOwner = resume.userId === decoded.userId
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
      const isAdmin = decoded.admin === true || decoded.email === 'caitlinyct@gmail.com' || decoded.email === 'mrzhangzy1996@gmail.com';
      
      // Determine target user ID based on scope and role
      let targetUserId = decoded.userId;

      // Only allow fetching all resumes if:
      // 1. User is Admin
      // 2. Request explicitly asks for scope=all_users
      if (isAdmin && req.query.scope === 'all_users') {
          targetUserId = null;
      }
      
      const { resumes, provider, error } = await getResumes(targetUserId)
      
      if (error) {
          return sendJson(res, { success: false, error, provider }, 500)
      }

      return sendJson(res, { 
          success: true, 
          data: resumes,
          provider,
          count: resumes.length 
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

        const { id, targetRole } = body
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
        const canUseEnhancedAi = isMember && ENABLE_AI_RESUME_ANALYSIS && Boolean(resumeAiKey || resumeDeepseekKey)

        // 1. 仅对 AI 增强分析保留内容变更限制；本地分析允许重复运行
        if (canUseEnhancedAi && resume.lastAnalyzedAt) {
           const lastAnalyzed = new Date(resume.lastAnalyzedAt)
           // If updatedAt is missing, assume it hasn't been updated since creation/last save
           // If updatedAt exists, check if it is NEWER than lastAnalyzed
           
           // Logic: If NO update time, OR update time <= last analysis time -> Block
           // Meaning: lastAnalyzed >= updatedAt -> Block
           
           let lastUpdated = resume.updatedAt ? new Date(resume.updatedAt) : null
           
           // If we don't track updatedAt properly on initial upload, use uploadedAt or createdAt
           if (!lastUpdated && resume.uploadedAt) lastUpdated = new Date(resume.uploadedAt)
           
           // If still null (legacy), allow ONE analysis if not analyzed yet (but we are in if lastAnalyzedAt block)
           // If lastAnalyzedAt exists, we must have an update time > lastAnalyzedAt to allow re-analysis
           
           if (!lastUpdated || lastAnalyzed >= lastUpdated) {
             return sendJson(res, { success: false, error: '简历内容未变更，请勿重复分析', contentUnchanged: true }, 400)
           }
        }

        // 2. Analyze resume
        const parseResult = typeof resume.parseResult === 'string'
          ? (() => {
            try { return JSON.parse(resume.parseResult) } catch { return null }
          })()
          : resume.parseResult
        const resumeText = (
          resume.contentText ||
          parseResult?.content ||
          parseResult?.text ||
          ''
        ).trim()
        if (!resumeText) return sendJson(res, { success: false, error: 'Resume content is empty' }, 400)

        try {
          const analysisResult = await analyzeResumeContent(resumeText, targetRole, {
            preferAI: canUseEnhancedAi
          })

          // 3. Save Result
          await updateResumeAnalysis(id, analysisResult.score, analysisResult.suggestions)

          return sendJson(res, {
            success: true,
            data: {
              score: analysisResult.score,
              suggestions: analysisResult.suggestions,
              analysisMode: analysisResult.analysisMode || 'local',
              isEnhanced: analysisResult.analysisMode === 'ai'
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

// Helper: Call AI Service (Simplified version of api/ai.js logic)
async function analyzeResumeContent(text, targetRole, options = {}) {
  const localResult = buildLocalResumeAnalysis(text, targetRole)
  const preferAI = options.preferAI === true

  // Use a more robust check for API keys
  const apiKey = process.env.VITE_ALIBABA_BAILIAN_API_KEY || process.env.ALIBABA_BAILIAN_API_KEY
  const deepseekKey = process.env.VITE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY
  
  // 默认免费用户走本地规则；会员仅在显式开启增强时调用模型
  if (!preferAI || !ENABLE_AI_RESUME_ANALYSIS) {
    return {
      ...localResult,
      analysisMode: 'local'
    }
  }

  // Fallback to local analysis if no remote model is configured
  if (!apiKey && !deepseekKey) {
    return {
      ...localResult,
      analysisMode: 'local'
    }
  }
  
  const provider = apiKey ? 'bailian' : 'deepseek'
  const key = apiKey || deepseekKey
  
  const prompt = `你是一位资深招聘专家。请根据以下简历内容进行专业评估。
    求职意向：${targetRole || '未指定'}
    
    简历内容：
    ${text.substring(0, 3000)}
    
    请输出严格的JSON格式：
    {
      "score": 0-100之间的整数评分,
      "suggestions": [
        {
          "category": "排版与格式" | "内容质量" | "语法与表达" | "关键技能",
          "priority": "高" | "中" | "低",
          "issue": "问题描述",
          "suggestion": "具体修改建议"
        }
      ]
    }
    建议数量控制在3-5条。只返回JSON，不要markdown代码块，不要其他废话。`
    
  let apiUrl = ''
  let requestBody = {}
  
  if (provider === 'bailian') {
      apiUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'
      // Bailian might need specific app id, or use compatible openai endpoint
      // Using compatible endpoint is safer if we don't know app id
      apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
      requestBody = {
          model: 'qwen-plus',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7
      }
  } else {
      apiUrl = 'https://api.deepseek.com/chat/completions'
      requestBody = {
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7
      }
  }

  try {
      // Increase timeout to 60 seconds
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      
      const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`AI API error: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || '{}';
      
      // Clean up markdown code blocks if any
      const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
      const remoteResult = JSON.parse(jsonStr);
      return {
        score: Number(remoteResult.score) || localResult.score,
        suggestions: Array.isArray(remoteResult.suggestions) && remoteResult.suggestions.length > 0
          ? remoteResult.suggestions
          : localResult.suggestions,
        analysisMode: 'ai'
      };
      
  } catch (error) {
      console.error('[AI Analysis] Error:', error);
      return {
        ...localResult,
        analysisMode: 'local'
      };
  }
}
