/**
 * Vercel Serverless Function - 简历数据管理 & 解析
 * bit.ly/resume-consolidation
 */

import { getResumes, saveResumes, saveUserResume, getResumeContent, deleteResume, updateResumeContent, updateResumeAnalysis } from '../server-utils/resume-storage.js'
import neonHelper from '../server-utils/dal/neon-helper.js'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { verifyToken, extractToken } from '../server-utils/auth-helpers.js'
import { createRequire } from 'module'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'

// Setup for Python script execution
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)

// Fallback dependencies for parsing
let pdfParse, mammoth

async function loadDependencies() {
  if (!pdfParse) {
    try { pdfParse = require('pdf-parse/lib/pdf-parse.js') } catch (e) { }
  }
  if (!mammoth) {
    try { mammoth = (await import('mammoth')).default } catch (e) { }
  }
}

function sendJson(res, body, status = 200) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
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

        // Find file part
        while (start < buffer.length) {
          const end = buffer.indexOf(boundaryBuffer, start)
          if (end === -1) break

          const part = buffer.slice(start, end)
          const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'))
          if (headerEnd !== -1) {
            const header = part.slice(0, headerEnd).toString()
            if (header.includes('filename=')) {
              const filenameMatch = header.match(/filename="([^"]+)"/)
              const filename = filenameMatch ? filenameMatch[1] : 'upload.file'
              let fileBuffer = part.slice(headerEnd + 4)
              // Remove trailing \r\n
              if (fileBuffer.slice(-2).toString() === '\r\n') {
                fileBuffer = fileBuffer.slice(0, -2)
              }
              resolve({ buffer: fileBuffer, filename })
              return
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
    const pythonScript = path.join(__dirname, '../server-utils/resume-parser.py')
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
      console.error('[resumes] Failed to start Python process:', err)
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

    return sendJson(res, {
      success: true,
      data: finalParsedData,
      status: finalParseStatus,
      id: savedResumeId
    })

  } catch (error) {
    console.error('[resumes] Upload error:', error)
    if (tempFilePath) {
      try { await fs.unlink(tempFilePath) } catch (e) { }
    }
    return sendJson(res, { success: false, error: error.message }, 500)
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

      // 下载简历
      if (action === 'download' && id) {
        const token = extractToken(req)
        if (!token) return sendJson(res, { success: false, error: 'Authentication required' }, 401)

        // Check verifyToken result - it might vary by implementation, assume payload or null
        const decoded = await verifyToken(token)
        if (!decoded) return sendJson(res, { success: false, error: 'Invalid token' }, 401)

        const { resumes } = await getResumes()
        const resume = resumes.find(r => r.id === id)
        if (!resume) return sendJson(res, { success: false, error: 'Resume not found' }, 404)

        // 权限检查
        const isOwner = resume.userId === decoded.userId
        const isAdmin = decoded.admin === true
        if (!isOwner && !isAdmin) return sendJson(res, { success: false, error: 'Permission denied' }, 403)

        if (!resume.localFilePath) return sendJson(res, { success: false, error: 'Local file not available' }, 404)

        try {
          await fs.access(resume.localFilePath)
          const fileBuffer = await fs.readFile(resume.localFilePath)

          const ext = path.extname(resume.fileName).toLowerCase()
          let contentType = 'application/octet-stream'
          if (ext === '.pdf') contentType = 'application/pdf'
          else if (ext === '.doc') contentType = 'application/msword'
          else if (ext === '.docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          else if (ext === '.txt') contentType = 'text/plain'

          res.setHeader('Content-Type', contentType)
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(resume.fileName)}"`)
          res.setHeader('Content-Length', fileBuffer.length)
          return res.status(200).send(fileBuffer)
        } catch (error) {
          return sendJson(res, { success: false, error: 'File not found on server' }, 404)
        }
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

      // 获取列表
      // Ensure we filter by userId if not admin
      const token = extractToken(req)
      if (!token) return sendJson(res, { success: false, error: 'Authentication required' }, 401)
      const decoded = await verifyToken(token)
      if (!decoded) return sendJson(res, { success: false, error: 'Invalid token' }, 401)

      const { resumes, provider } = await getResumes()
      
      // Filter resumes for current user unless admin
      let filteredResumes = resumes
      if (!decoded.admin) {
        filteredResumes = resumes.filter(r => r.userId === decoded.userId)
      }

      res.setHeader('X-Storage-Provider', provider)
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
      
      return sendJson(res, {
        success: true,
        data: filteredResumes,
        provider,
        count: filteredResumes.length
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
                const userRows = await neonHelper.query(
                    `SELECT membership_level, membership_expire_at FROM users WHERE user_id = $1`,
                    [decoded.userId]
                )
                if (userRows && userRows.length > 0) {
                    const u = userRows[0]
                    if (u.membership_level && u.membership_level !== 'none') {
                        const expireAt = new Date(u.membership_expire_at)
                        if (expireAt > new Date()) {
                            isMember = true
                        }
                    }
                }
            } catch (e) {
                console.warn('[Resumes] Failed to check membership:', e)
            }
        }

        // 1. Check User Frequency Limit (1 per day for non-members)
        if (!isMember) {
            const userResumes = resumes.filter(r => r.userId === decoded.userId)
            const now = new Date()
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

            const recentAnalysis = userResumes.find(r => {
              if (!r.lastAnalyzedAt) return false
              const analyzedAt = new Date(r.lastAnalyzedAt)
              return analyzedAt > oneDayAgo
            })

            if (recentAnalysis) {
              return sendJson(res, { success: false, error: '非会员每天只能使用1次简历分析功能', limitReached: true }, 429)
            }
        }

        // 2. Check Content Change (Strict check for everyone: must be updated since last analysis)
        if (resume.lastAnalyzedAt) {
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

        // 3. Call AI Service
        const resumeText = resume.contentText || ''
        if (!resumeText) return sendJson(res, { success: false, error: 'Resume content is empty' }, 400)

        try {
          const analysisResult = await analyzeResumeContent(resumeText, targetRole)

          // 4. Save Result
          await updateResumeAnalysis(id, analysisResult.score, analysisResult.suggestions)

          return sendJson(res, {
            success: true,
            data: {
              score: analysisResult.score,
              suggestions: analysisResult.suggestions
            }
          })
        } catch (aiErr) {
          console.error('AI Analysis failed:', aiErr)
          return sendJson(res, { success: false, error: 'AI服务繁忙，请稍后重试' }, 500)
        }
      }

      // Handle content update
      if (body.action === 'update_content') {
        const token = extractToken(req)
        if (!token) return sendJson(res, { success: false, error: 'Unauthorized' }, 401)
        
        if (!body.id || !body.contentText) {
           return sendJson(res, { success: false, error: 'Missing id or contentText' }, 400)
        }
        const result = await updateResumeContent(body.id, body.contentText)
        return sendJson(res, result)
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
        // Use deleteResume for cleaner removal including content
        const result = await deleteResume(id)
        return sendJson(res, {
          success: result.success,
          deletedId: id,
          remainingCount: result.count
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
async function analyzeResumeContent(text, targetRole) {
  // Use a more robust check for API keys
  const apiKey = process.env.VITE_ALIBABA_BAILIAN_API_KEY || process.env.ALIBABA_BAILIAN_API_KEY
  const deepseekKey = process.env.VITE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY
  
  // Fallback to DeepSeek if configured, or throw
  if (!apiKey && !deepseekKey) {
    throw new Error('AI API Key missing')
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
      return JSON.parse(jsonStr);
      
  } catch (error) {
      console.error('[AI Analysis] Error:', error);
      throw error; // Re-throw to be handled by caller
  }
}
