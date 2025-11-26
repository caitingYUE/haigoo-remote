
import fs from 'fs/promises'
import path from 'path'
import { verifyToken, extractToken } from '../server-utils/auth-helpers.js'
import { getResumes } from '../server-utils/resume-storage.js'

function sendJson(res, body, status = 200) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.status(status).json(body)
}

export default async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        return res.status(200).end()
    }

    if (req.method !== 'GET') {
        return sendJson(res, { success: false, error: 'Method not allowed' }, 405)
    }

    try {
        // 验证用户身份
        const token = extractToken(req)
        if (!token) {
            return sendJson(res, { success: false, error: 'Authentication required' }, 401)
        }

        const decoded = await verifyToken(token)
        if (!decoded) {
            return sendJson(res, { success: false, error: 'Invalid token' }, 401)
        }

        const { id } = req.query
        if (!id) {
            return sendJson(res, { success: false, error: 'Resume ID required' }, 400)
        }

        // 获取简历记录
        const { resumes } = await getResumes()
        const resume = resumes.find(r => r.id === id)

        if (!resume) {
            return sendJson(res, { success: false, error: 'Resume not found' }, 404)
        }

        // 权限检查：只能下载自己的简历，或管理员可以下载所有
        const isOwner = resume.userId === decoded.userId
        const isAdmin = decoded.admin === true

        if (!isOwner && !isAdmin) {
            return sendJson(res, { success: false, error: 'Permission denied' }, 403)
        }

        // 检查本地文件路径
        if (!resume.localFilePath) {
            return sendJson(res, {
                success: false,
                error: 'Local file not available. This feature is only enabled in local testing mode.'
            }, 404)
        }

        // 检查文件是否存在
        try {
            await fs.access(resume.localFilePath)
        } catch (error) {
            return sendJson(res, {
                success: false,
                error: 'File not found on server'
            }, 404)
        }

        // 读取文件
        const fileBuffer = await fs.readFile(resume.localFilePath)

        // 确定 Content-Type
        const ext = path.extname(resume.fileName).toLowerCase()
        let contentType = 'application/octet-stream'

        if (ext === '.pdf') {
            contentType = 'application/pdf'
        } else if (ext === '.doc') {
            contentType = 'application/msword'
        } else if (ext === '.docx') {
            contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        } else if (ext === '.txt') {
            contentType = 'text/plain'
        }

        // 设置响应头
        res.setHeader('Content-Type', contentType)
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(resume.fileName)}"`)
        res.setHeader('Content-Length', fileBuffer.length)
        res.setHeader('Access-Control-Allow-Origin', '*')

        // 发送文件
        return res.status(200).send(fileBuffer)

    } catch (error) {
        console.error('[resume-file] Error:', error)
        return sendJson(res, { success: false, error: error.message }, 500)
    }
}
