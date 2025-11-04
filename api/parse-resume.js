/**
 * Vercel Edge Function - 简历文件解析代理
 * 通过服务端转发到开源解析服务（建议 Apache Tika Server）
 * 支持 multipart/form-data 上传文件、或 JSON 提供 fileUrl/base64
 */

export const config = {
  runtime: 'edge',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function decodeBase64(base64) {
  // Edge runtime 下可用 atob/Uint8Array
  const binaryString = atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i)
  return bytes.buffer
}

export default async function handler(request) {
  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200 })
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const TIKA_URL = process.env.TIKA_URL
  if (!TIKA_URL) {
    return json({ error: 'TIKA_URL not configured' }, 500)
  }

  try {
    const contentType = request.headers.get('content-type') || ''
    let bodyArrayBuffer = null
    let filename = 'upload.file'

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('file')
      if (!file || typeof file === 'string') {
        return json({ error: 'Missing file in form-data "file" field' }, 400)
      }
      filename = file.name || filename
      bodyArrayBuffer = await file.arrayBuffer()
    } else if (contentType.includes('application/json')) {
      const data = await request.json()
      if (data?.fileUrl) {
        const resp = await fetch(data.fileUrl)
        if (!resp.ok) {
          return json({ error: `Failed to fetch fileUrl: ${resp.status}` }, 400)
        }
        bodyArrayBuffer = await resp.arrayBuffer()
        // 尝试保留文件名
        const url = new URL(data.fileUrl)
        filename = url.pathname.split('/').pop() || filename
      } else if (data?.base64) {
        bodyArrayBuffer = decodeBase64(data.base64)
        filename = data?.filename || filename
      } else {
        return json({ error: 'Unsupported JSON payload. Use { fileUrl } or { base64, filename }' }, 400)
      }
    } else {
      // 原始二进制
      bodyArrayBuffer = await request.arrayBuffer()
    }

    if (!bodyArrayBuffer) {
      return json({ error: 'Empty file payload' }, 400)
    }

    // 代理到 Tika Server 的 /tika 端点（返回纯文本）
    const endpoint = `${TIKA_URL.replace(/\/$/, '')}/tika`
    const tikaResp = await fetch(endpoint, {
      method: 'PUT', // Tika 支持 PUT 方式上传文件
      headers: {
        'Accept': 'text/plain',
        'X-File-Name': filename
      },
      body: bodyArrayBuffer
    })

    if (!tikaResp.ok) {
      const errText = await tikaResp.text().catch(() => '')
      return json({ success: false, error: 'Tika parse failed', status: tikaResp.status, details: errText }, 502)
    }

    const text = await tikaResp.text()
    return json({ success: true, data: { text } }, 200)
  } catch (error) {
    return json({ success: false, error: error?.message || 'Unknown error' }, 500)
  }
}