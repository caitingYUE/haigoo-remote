/**
 * Vercel Serverless Function - 简历数据管理
 * 支持存储到 Redis / Vercel KV
 */

import { getResumes, saveResumes } from '../server-utils/resume-storage.js'
import { kv } from '../server-utils/kv-client.js'
import { createClient } from 'redis'
import fs from 'fs/promises'
import path from 'path'
import { verifyToken, extractToken } from '../server-utils/auth-helpers.js'

function sendJson(res, body, status = 200) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.status(status).json(body)
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

      // 下载简历 (Merged from api/resume-file.js)
      if (action === 'download' && id) {
        // 验证用户身份
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

      // 获取列表
      const { resumes, provider } = await getResumes()

      res.setHeader('X-Storage-Provider', provider)

      return sendJson(res, {
        success: true,
        data: resumes,
        provider,
        count: resumes.length
      })
    }

    // POST - 保存简历（批量或追加）
    if (req.method === 'POST') {
      const chunks = []
      for await (const chunk of req) {
        chunks.push(chunk)
      }
      const body = JSON.parse(Buffer.concat(chunks).toString())

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
        mode
      })
    }

    // DELETE - 删除简历
    if (req.method === 'DELETE') {
      const { id } = req.query

      if (id) {
        // 删除单个
        const { resumes } = await getResumes()
        const filtered = resumes.filter(r => r.id !== id)
        const result = await saveResumes(filtered)

        return sendJson(res, {
          success: result.success,
          deletedId: id,
          remainingCount: result.count
        })
      } else {
        // 清空所有
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


