import path from 'node:path'
import { createRequire } from 'node:module'
import { extractStructuredResume } from './resume-structure-extractor.js'

const require = createRequire(import.meta.url)
const MAX_BYTES = 2 * 1024 * 1024
const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt'])
let pdfParse
let mammoth

async function loadParsers() {
  if (!pdfParse) pdfParse = require('pdf-parse')
  if (!mammoth) mammoth = (await import('mammoth')).default
}

export async function parseCareerResumeBuffer({ filename, buffer }) {
  const safeName = path.basename(String(filename || 'resume.txt')).slice(0, 160)
  const extension = path.extname(safeName).toLowerCase()
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    const error = new Error('仅支持 PDF、DOCX 或 TXT 简历')
    error.code = 'UNSUPPORTED_RESUME_TYPE'
    throw error
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const error = new Error('简历文件为空，请重新选择')
    error.code = 'EMPTY_RESUME'
    throw error
  }
  if (buffer.length > MAX_BYTES) {
    const error = new Error('简历不能超过 2MB')
    error.code = 'RESUME_TOO_LARGE'
    throw error
  }

  await loadParsers()
  let text = ''
  if (extension === '.pdf') {
    if (!buffer.subarray(0, 5).toString('ascii').startsWith('%PDF')) throw new Error('PDF 文件格式无法识别')
    text = String((await pdfParse(buffer)).text || '')
  } else if (extension === '.docx') {
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw new Error('DOCX 文件格式无法识别')
    text = String((await mammoth.extractRawText({ buffer })).value || '')
  } else {
    text = buffer.toString('utf8')
  }

  text = text.replace(/\0/g, '').replace(/\r\n/g, '\n').trim()
  if (text.length < 80) throw new Error('简历中可读取的职业信息太少，请改用手动填写')
  return { filename: safeName, text, structured: extractStructuredResume(text) }
}

export const CAREER_RESUME_MAX_BYTES = MAX_BYTES
