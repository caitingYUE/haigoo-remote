import Busboy from 'busboy'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')
import mammoth from 'mammoth'
import { fileTypeFromBuffer } from 'file-type'
import { lookup as mimeLookup } from 'mime-types'
import { createWorker } from 'tesseract.js'

const ENABLE_OCR = process.env.ENABLE_OCR === 'true'

function sendJson(res, body, status = 200) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

async function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    try {
      const bb = Busboy({ headers: req.headers })
      let filename = 'upload.file'
      const chunks = []
      let fileMime = ''

      bb.on('file', (fieldname, file, info) => {
        filename = info?.filename || filename
        fileMime = info?.mimeType || ''
        file.on('data', (data) => chunks.push(data))
      })
      bb.on('finish', () => {
        const buffer = Buffer.concat(chunks)
        resolve({ buffer, filename, fileMime })
      })
      bb.on('error', (err) => reject(err))
      req.pipe(bb)
    } catch (err) {
      reject(err)
    }
  })
}

async function detectType(buffer, filename, headerContentType) {
  const ft = await fileTypeFromBuffer(buffer).catch(() => null)
  if (ft) return { mime: ft.mime, ext: ft.ext }
  const mime = headerContentType || mimeLookup(filename) || 'application/octet-stream'
  const ext = (filename?.split('.').pop() || '').toLowerCase()
  return { mime, ext }
}

async function ocrImageBuffer(buffer, lang = 'eng') {
  if (!ENABLE_OCR) {
    return ''
  }
  const worker = await createWorker({ logger: () => {} })
  try {
    await worker.loadLanguage(lang)
    await worker.initialize(lang)
    const { data } = await worker.recognize(buffer)
    return (data?.text || '').trim()
  } finally {
    await worker.terminate()
  }
}

async function extractText({ buffer, mime, ext }) {
  const lowerExt = (ext || '').toLowerCase()
  if (mime === 'application/pdf' || lowerExt === 'pdf') {
    const result = await pdfParse(buffer)
    const text = (result?.text || '').trim()
    return { text }
  }
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowerExt === 'docx'
  ) {
    const result = await mammoth.extractRawText({ buffer })
    const text = (result?.value || '').trim()
    return { text }
  }
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg'].includes(lowerExt)) {
    const text = await ocrImageBuffer(buffer, 'eng')
    return { text }
  }
  if (mime.startsWith('text/') || lowerExt === 'txt') {
    const text = buffer.toString('utf-8').trim()
    return { text }
  }
  const text = buffer.toString('utf-8').trim()
  return { text }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  if (req.method !== 'POST') {
    return sendJson(res, { error: 'Method not allowed' }, 405)
  }

  try {
    const contentType = req.headers['content-type'] || ''
    let buffer = null
    let filename = 'upload.file'

    if (contentType.includes('multipart/form-data')) {
      const parsed = await parseMultipart(req)
      buffer = parsed.buffer
      filename = parsed.filename || filename
    } else if (contentType.includes('application/json')) {
      const chunks = []
      await new Promise((resolve) => {
        req.on('data', (d) => chunks.push(d))
        req.on('end', resolve)
      })
      const jsonStr = Buffer.concat(chunks).toString('utf-8')
      const data = JSON.parse(jsonStr || '{}')
      if (data?.base64) {
        buffer = Buffer.from(data.base64, 'base64')
        filename = data?.filename || filename
      } else if (data?.fileUrl) {
        const resp = await fetch(data.fileUrl)
        if (!resp.ok) {
          return sendJson(res, { error: `Failed to fetch fileUrl: ${resp.status}` }, 400)
        }
        const arrayBuf = await resp.arrayBuffer()
        buffer = Buffer.from(arrayBuf)
        const url = new URL(data.fileUrl)
        filename = url.pathname.split('/').pop() || filename
      } else {
        return sendJson(res, { error: 'Unsupported JSON payload. Use { fileUrl } or { base64, filename }' }, 400)
      }
    } else {
      const chunks = []
      await new Promise((resolve) => {
        req.on('data', (d) => chunks.push(d))
        req.on('end', resolve)
      })
      buffer = Buffer.concat(chunks)
    }

    if (!buffer || buffer.length === 0) {
      return sendJson(res, { error: 'Empty file payload' }, 400)
    }

    const type = await detectType(buffer, filename, req.headers['content-type'])
    try {
      const { text } = await extractText({ buffer, mime: type.mime, ext: type.ext })
      if (!text || !text.trim()) {
        return sendJson(res, { success: false, error: 'Parse returned empty text' }, 200)
      }
      return sendJson(res, { success: true, data: { text } }, 200)
    } catch (e) {
      return sendJson(res, { success: false, error: e?.message || 'Parse failed' }, 200)
    }
  } catch (error) {
    return sendJson(res, { success: false, error: error?.message || 'Unknown error' }, 500)
  }
}