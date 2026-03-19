import dns from 'node:dns/promises'
import tls from 'node:tls'

import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

const HOST = 'openws.work.weixin.qq.com'
const WS_URL = `wss://${HOST}`
const BOT_ID = process.env.WECOM_AIBOT_BOT_ID
const BOT_SECRET = process.env.WECOM_AIBOT_SECRET

function logStep(name, ok, detail = '') {
  const prefix = ok ? 'PASS' : 'FAIL'
  console.log(`[${prefix}] ${name}${detail ? ` - ${detail}` : ''}`)
}

async function checkEnv() {
  const ok = Boolean(BOT_ID && BOT_SECRET)
  logStep('Env', ok, ok ? 'WECOM_AIBOT_BOT_ID / WECOM_AIBOT_SECRET 已加载' : '缺少 WECOM_AIBOT_BOT_ID 或 WECOM_AIBOT_SECRET')
  return ok
}

async function checkDns() {
  try {
    const result = await dns.lookup(HOST)
    logStep('DNS', true, `${HOST} -> ${result.address}`)
    return true
  } catch (error) {
    logStep('DNS', false, error.message)
    return false
  }
}

async function checkTls() {
  return await new Promise((resolve) => {
    const socket = tls.connect({
      host: HOST,
      port: 443,
      servername: HOST,
      rejectUnauthorized: true
    })

    socket.once('secureConnect', () => {
      const protocol = socket.getProtocol()
      logStep('TLS', true, `握手成功 (${protocol || 'unknown protocol'})`)
      socket.end()
      resolve(true)
    })

    socket.once('error', (error) => {
      logStep('TLS', false, error.message)
      resolve(false)
    })
  })
}

async function checkWebSocket() {
  return await new Promise((resolve) => {
    let settled = false
    const ws = new WebSocket(WS_URL)

    const finish = (ok, detail) => {
      if (settled) return
      settled = true
      logStep('WebSocket', ok, detail)
      try {
        ws.close()
      } catch (_) {}
      resolve(ok)
    }

    ws.addEventListener('open', () => {
      finish(true, `成功连接 ${WS_URL}`)
    })

    ws.addEventListener('error', (event) => {
      finish(false, event?.error?.message || 'Received network error or non-101 status code')
    })

    ws.addEventListener('close', (event) => {
      if (!settled) {
        finish(false, `close code=${event.code || 'unknown'} reason=${event.reason || 'empty'}`)
      }
    })

    setTimeout(() => {
      finish(false, '超时，未能建立 WebSocket 连接')
    }, 10000)
  })
}

async function main() {
  console.log('== WeCom Aibot Doctor ==')
  await checkEnv()
  const dnsOk = await checkDns()
  if (!dnsOk) process.exit(1)

  const tlsOk = await checkTls()
  if (!tlsOk) process.exit(1)

  const wsOk = await checkWebSocket()
  if (!wsOk) {
    console.log('\nLikely causes:')
    console.log('1. 本地网络/VPN/代理拦截了 WebSocket 握手')
    console.log('2. 企业微信长连接地址在当前网络环境不可达')
    console.log('3. 被安全软件、公司网络策略或地区网络出口限制')
    process.exit(1)
  }

  console.log('\nNext step:')
  console.log('1. 如果这里通过，再运行 npm run wecom-bot:worker')
  console.log('2. 在目标群里 @机器人 发送一条消息，学习 chatid')
}

main().catch((error) => {
  console.error('Doctor crashed:', error)
  process.exit(1)
})
