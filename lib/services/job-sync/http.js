import http from 'node:http'
import https from 'node:https'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib'

const nextRequest = new Map()
export class SourceError extends Error {
  constructor(message, status = 'failed', retryAfter = 0) {
    super(message)
    this.status = status
    this.retryAfter = retryAfter
  }
}
export function decodeResponseBody(buffer, encoding, maxBytes) {
  const codec = String(encoding || 'identity').trim().toLowerCase()
  const decompress = { gzip:gunzipSync, deflate:inflateSync, br:brotliDecompressSync }[codec]
  if (!decompress && codec!=='identity') throw new SourceError('招聘页面使用不支持的压缩格式', 'partial')
  try {
    const decoded=decompress?decompress(buffer,{maxOutputLength:maxBytes}):buffer
    if (decoded.length>maxBytes) throw new Error('response too large')
    return decoded.toString('utf8')
  } catch { throw new SourceError('招聘页面解压失败或正文超过读取上限', 'partial') }
}
export function isPublicAddress(address) {
  if (isIP(address) === 6)
    return (
      /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:(?:db8|0):/i.test(address)
    )
  if (isIP(address) !== 4) return false
  const [a, b] = address.split('.').map(Number)
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || b === 2)) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0)
  )
}
export function validatePublicUrl(raw) {
  const u = new URL(raw)
  const hostname = u.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (
    !['https:', 'http:'].includes(u.protocol) ||
    u.username ||
    u.password ||
    (u.port && !['80', '443'].includes(u.port)) ||
    hostname === 'localhost' ||
    (!hostname.includes('.') && !isIP(hostname)) ||
    /\.(local|internal|localhost)$/.test(hostname) ||
    (isIP(hostname) && !isPublicAddress(hostname))
  )
    throw new SourceError('招聘网址必须指向公开网站', 'blocked')
  return u
}
const delay = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const abort = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', abort, { once: true })
  })

// DNS results are checked AND pinned to this connection, including each redirect.
export async function fetchPublic(
  raw,
  {
    signal,
    method = 'GET',
    body,
    headers = {},
    maxBytes = 12 * 1024 * 1024
  } = {}
) {
  let url = raw
  for (let redirect = 0; redirect <= 5; redirect++) {
    const u = validatePublicUrl(url)
    if (signal?.aborted) throw signal.reason
    let dnsTimer, abortDns
    const addresses = await Promise.race([
      lookup(u.hostname.replace(/^\[|\]$/g, ''), { all: true }),
      new Promise((_, reject) => {
        dnsTimer = setTimeout(
          () => reject(new SourceError('招聘网站 DNS 查询超时')),
          10000
        )
        abortDns = () => reject(signal.reason)
        signal?.addEventListener('abort', abortDns, { once: true })
      })
    ]).finally(() => {
      clearTimeout(dnsTimer)
      signal?.removeEventListener('abort', abortDns)
    })
    if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
      throw new SourceError('招聘网址解析到非公开网络', 'blocked')
    const now = Date.now(),
      start = Math.max(now, nextRequest.get(u.hostname) || 0)
    nextRequest.set(u.hostname, start + 1000)
    if (start > now) await delay(start - now, signal)
    const controller = new AbortController()
    const abort = () => controller.abort(signal.reason)
    if (signal?.aborted) throw signal.reason
    signal?.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(
      () => controller.abort(new SourceError('招聘网站请求超时')),
      20000
    )
    let response
    try {
      response = await new Promise((resolve, reject) => {
        const req = (u.protocol === 'https:' ? https : http).request(
          u,
          {
            method,
            signal: controller.signal,
            headers: {
              'User-Agent': 'HaigooJobSync/1.0 (+https://haigooremote.com)',
              Accept: 'application/json,text/html,application/xml',
              ...headers
            },
            lookup: (_host, options, cb) =>
              options.all
                ? cb(null, addresses)
                : cb(null, addresses[0].address, addresses[0].family)
          },
          (res) => {
            const chunks = []
            let bytes = 0
            res.on('data', (chunk) => {
              bytes += chunk.length
              if (bytes > maxBytes) {
                req.destroy(new SourceError('招聘页面超过读取上限', 'partial'))
                return
              }
              chunks.push(chunk)
            })
            res.on('error', reject)
            res.on('end', () => {
              try { resolve({
                status: res.statusCode,
                headers: res.headers,
                text: decodeResponseBody(Buffer.concat(chunks), res.headers['content-encoding'], maxBytes),
                url: u.href
              }) } catch (error) { reject(error) }
            })
          }
        )
        req.on('error', reject)
        if (body)
          req.write(typeof body === 'string' ? body : JSON.stringify(body))
        req.end()
      })
    } catch (error) {
      if (controller.signal.aborted) throw controller.signal.reason
      throw error
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    }
    if (
      [301, 302, 303, 307, 308].includes(response.status) &&
      response.headers.location
    ) {
      url = new URL(response.headers.location, u).href
      if (response.status === 303) {
        method = 'GET'
        body = undefined
      }
      continue
    }
    if ([401, 403, 429, 999].includes(response.status))
      throw new SourceError(
        `访问受限（HTTP ${response.status}）`,
        'blocked',
        parseRetryAfter(response.headers['retry-after'])
      )
    if (response.status >= 500)
      throw new SourceError(`来源暂时不可用（HTTP ${response.status}）`)
    return response
  }
  throw new SourceError('招聘网址跳转次数过多', 'blocked')
}
export function parseRetryAfter(value) {
  if (!value) return 0
  const seconds = Number(value)
  return Math.max(
    0,
    Math.min(
      86400,
      Number.isFinite(seconds)
        ? seconds
        : (Date.parse(value) - Date.now()) / 1000
    )
  )
}
export function requireJson(response) {
  if (response.status !== 200)
    throw new SourceError(
      `岗位列表请求失败（HTTP ${response.status}），不代表岗位关闭`
    )
  try {
    return JSON.parse(response.text)
  } catch {
    throw new SourceError('岗位列表未返回有效 JSON', 'partial')
  }
}
