/**
 * Vercel Serverless Function - 简历解析（轻量级方案）
 * 使用纯 Node.js 实现，不依赖外部服务
 * 支持：PDF（使用 pdf-parse）、DOCX（使用 mammoth）、TXT
 */

import { createRequire } from 'module'
const require = createRequire(import.meta.url)

// 动态导入以避免打包问题
let pdfParse, mammoth

async function loadDependencies() {
  if (!pdfParse) {
    pdfParse = require('pdf-parse/lib/pdf-parse.js')
  }
  if (!mammoth) {
    mammoth = (await import('mammoth')).default
  }
}

function sendJson(res, body, status = 200) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.status(status).json(body)
}

// 解析 multipart/form-data（手动实现，避免依赖 busboy）
async function parseMultipartSimple(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks)
        const boundary = req.headers['content-type']?.split('boundary=')[1]
        if (!boundary) {
          return reject(new Error('No boundary found'))
        }
        
        // 简单解析：找到文件内容
        const boundaryBuffer = Buffer.from(`--${boundary}`)
        const parts = []
        let start = 0
        
        while (true) {
          const idx = buffer.indexOf(boundaryBuffer, start)
          if (idx === -1) break
          if (start > 0) {
            parts.push(buffer.slice(start, idx))
          }
          start = idx + boundaryBuffer.length
        }
        
        // 找到包含文件数据的部分
        for (const part of parts) {
          const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'))
          if (headerEnd === -1) continue
          
          const header = part.slice(0, headerEnd).toString()
          if (!header.includes('filename=')) continue
          
          // 提取文件名
          const filenameMatch = header.match(/filename="([^"]+)"/)
          const filename = filenameMatch ? filenameMatch[1] : 'upload.file'
          
          // 文件内容（去掉末尾的\r\n）
          let fileBuffer = part.slice(headerEnd + 4)
          if (fileBuffer.slice(-2).toString() === '\r\n') {
            fileBuffer = fileBuffer.slice(0, -2)
          }
          
          resolve({ buffer: fileBuffer, filename })
          return
        }
        
        reject(new Error('No file found in multipart data'))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

// 从文件扩展名判断类型
function getFileType(filename) {
  const ext = (filename || '').toLowerCase().split('.').pop()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'doc') return 'doc' // 暂不支持旧版 DOC
  if (ext === 'txt') return 'txt'
  return 'unknown'
}

// 提取文本
async function extractText(buffer, fileType) {
  await loadDependencies()
  
  if (fileType === 'pdf') {
    try {
      const data = await pdfParse(buffer)
      return { text: (data.text || '').trim() }
    } catch (e) {
      console.error('[parse-resume] PDF parse error:', e.message)
      return { text: '', error: 'PDF解析失败' }
    }
  }
  
  if (fileType === 'docx') {
    try {
      const result = await mammoth.extractRawText({ buffer })
      return { text: (result.value || '').trim() }
    } catch (e) {
      console.error('[parse-resume] DOCX parse error:', e.message)
      return { text: '', error: 'DOCX解析失败' }
    }
  }
  
  if (fileType === 'txt') {
    try {
      const text = buffer.toString('utf-8').trim()
      return { text }
    } catch (e) {
      return { text: '', error: 'TXT解析失败' }
    }
  }
  
  return { text: '', error: `不支持的文件类型: ${fileType}` }
}

export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    return sendJson(res, {}, 200)
  }
  
  if (req.method !== 'POST') {
    return sendJson(res, { success: false, error: 'Method not allowed' }, 405)
  }

  try {
    const contentType = req.headers['content-type'] || ''
    let buffer = null
    let filename = 'upload.file'

    // 处理 multipart/form-data
    if (contentType.includes('multipart/form-data')) {
      try {
        const parsed = await parseMultipartSimple(req)
        buffer = parsed.buffer
        filename = parsed.filename
      } catch (e) {
        console.error('[parse-resume] Multipart parse error:', e.message)
        return sendJson(res, { 
          success: false, 
          error: 'Failed to parse multipart data: ' + e.message 
        }, 400)
      }
    }
    // 处理 JSON (base64 或 fileUrl)
    else if (contentType.includes('application/json')) {
      const chunks = []
      for await (const chunk of req) {
        chunks.push(chunk)
      }
      const body = JSON.parse(Buffer.concat(chunks).toString())
      
      if (body.base64) {
        buffer = Buffer.from(body.base64, 'base64')
        filename = body.filename || filename
      } else if (body.fileUrl) {
        const resp = await fetch(body.fileUrl)
        if (!resp.ok) {
          return sendJson(res, { 
            success: false, 
            error: `Failed to fetch file: ${resp.status}` 
          }, 400)
        }
        const arrayBuf = await resp.arrayBuffer()
        buffer = Buffer.from(arrayBuf)
        filename = body.filename || new URL(body.fileUrl).pathname.split('/').pop() || filename
      } else {
        return sendJson(res, { 
          success: false, 
          error: 'JSON payload must include "base64" or "fileUrl"' 
        }, 400)
      }
    }
    // 处理原始二进制
    else {
      const chunks = []
      for await (const chunk of req) {
        chunks.push(chunk)
      }
      buffer = Buffer.concat(chunks)
    }

    if (!buffer || buffer.length === 0) {
      return sendJson(res, { success: false, error: 'Empty file' }, 400)
    }

    // 检测文件类型
    const fileType = getFileType(filename)
    
    console.log(`[parse-resume] Parsing ${filename} (${fileType}), size: ${buffer.length} bytes`)

    // 提取文本
    const { text, error } = await extractText(buffer, fileType)

    if (error || !text || text.length === 0) {
      return sendJson(res, { 
        success: false, 
        error: error || 'Failed to extract text',
        fileType
      }, 200)
    }

    console.log(`[parse-resume] Success: extracted ${text.length} chars from ${filename}`)

    return sendJson(res, { 
      success: true, 
      data: { 
        text,
        filename,
        fileType,
        length: text.length
      } 
    }, 200)

  } catch (error) {
    console.error('[parse-resume] Handler error:', error)
    return sendJson(res, { 
      success: false, 
      error: error.message || 'Unknown error' 
    }, 500)
  }
}

