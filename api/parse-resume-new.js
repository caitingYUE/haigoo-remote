
import { createRequire } from 'module'
import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { verifyToken, extractToken } from '../server-utils/auth-helpers.js'
import { saveUserResume } from '../server-utils/resume-storage.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)

// Fallback dependencies
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.status(status).json(body)
}

// Parse multipart/form-data manually
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
    console.log(`[parse-resume] Spawning python: ${pythonScript} ${filePath}`)

    const pythonProcess = spawn('python3', [pythonScript, filePath])

    let stdout = ''
    let stderr = ''

    pythonProcess.stdout.on('data', (data) => stdout += data.toString())
    pythonProcess.stderr.on('data', (data) => stderr += data.toString())

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`[parse-resume] Python exited with code ${code}: ${stderr}`)
        return resolve(null)
      }
      try {
        const result = JSON.parse(stdout)
        resolve(result)
      } catch (e) {
        console.error(`[parse-resume] Failed to parse Python output: ${stdout}`)
        resolve(null)
      }
    })
  })
}

export default async function handler(req, res) {
  console.log('[parse-resume] === NEW REQUEST ===')
  console.log('[parse-resume] Method:', req.method)
  console.log('[parse-resume] Content-Type:', req.headers['content-type'])

  if (req.method === 'OPTIONS') return sendJson(res, {}, 200)
  if (req.method !== 'POST') return sendJson(res, { success: false, error: 'Method not allowed' }, 405)

  // 1. Verify Auth
  const token = extractToken(req)
  if (!token) {
    console.error('[parse-resume] No token provided')
    return sendJson(res, { success: false, error: 'Unauthorized' }, 401)
  }
  const payload = verifyToken(token)
  if (!payload || !payload.userId) {
    console.error('[parse-resume] Invalid token')
    return sendJson(res, { success: false, error: 'Invalid token' }, 401)
  }
  const userId = payload.userId
  console.log('[parse-resume] User ID:', userId)

  let tempFilePath = null

  try {
    const contentType = req.headers['content-type'] || ''
    let buffer = null
    let filename = 'upload.file'

    if (contentType.includes('multipart/form-data')) {
      const parsed = await parseMultipartSimple(req)
      buffer = parsed.buffer
      filename = parsed.filename
    } else {
      // ...
      return sendJson(res, { success: false, error: 'Only multipart/form-data supported' }, 400)
    }

    if (!buffer || buffer.length === 0) return sendJson(res, { success: false, error: 'Empty file' }, 400)

    // Save to temp file
    const tempDir = os.tmpdir()
    tempFilePath = path.join(tempDir, `resume-${Date.now()}-${filename}`)
    await fs.writeFile(tempFilePath, buffer)

    console.log(`[parse-resume] Saved temp file: ${tempFilePath}`)

    // Try Python parsing first
    const pythonResult = await parseWithPython(tempFilePath)
    let parsedData = null
    let parseStatus = 'failed'

    if (pythonResult && pythonResult.success) {
      console.log('[parse-resume] Python parse success')
      parsedData = {
        ...pythonResult.data,
        text: pythonResult.data.content || '',
        raw: pythonResult.data
      }
      parseStatus = 'success'
    } else {
      console.log('[parse-resume] Python parse failed, falling back to Node.js')
      // Fallback to Node.js parsing
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

    // 本地测试模式：保留文件；生产模式：删除文件
    const isLocalMode = process.env.RESUME_STORAGE_MODE === 'local'
    let localFilePath = null

    if (isLocalMode) {
      // 本地模式：保留文件用于测试
      localFilePath = tempFilePath
      console.log(`[parse-resume] Local mode: preserving file at ${tempFilePath}`)
    } else {
      // 生产模式：删除临时文件
      try { await fs.unlink(tempFilePath) } catch (e) { }
    }

    if (parsedData) {
      // Save to storage
      const resumeRecord = {
        fileName: filename,
        size: buffer.length,
        parseStatus,
        parsedData,
        localFilePath, // 保存本地文件路径（仅本地模式有值）
        uploadedAt: new Date().toISOString()
      }

      await saveUserResume(userId, resumeRecord)
      console.log(`[parse-resume] Saved resume for user ${userId}`)

      return sendJson(res, {
        success: true,
        data: parsedData
      })
    }

    return sendJson(res, { success: false, error: 'Parsing failed' }, 500)

  } catch (error) {
    console.error('[parse-resume] ===  ERROR ===')
    console.error('[parse-resume] Error message:', error.message)
    console.error('[parse-resume] Error stack:', error.stack)
    if (tempFilePath) {
      console.error('[parse-resume] Temp file path:', tempFilePath)
      try { await fs.unlink(tempFilePath) } catch (e) {
        console.error('[parse-resume] Failed to cleanup temp file:', e.message)
      }
    }
    return sendJson(res, { success: false, error: error.message }, 500)
  }
}

