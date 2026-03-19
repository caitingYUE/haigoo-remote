import { buildWecomReqId } from './wecom-aibot-queue-service.js'

const WECOM_AIBOT_WS_URL = 'wss://openws.work.weixin.qq.com'
const DEFAULT_REQUEST_TIMEOUT_MS = 15000

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatErrorMessage(error) {
  return error?.message || String(error || 'Unknown error')
}

export class WecomAibotClient {
  constructor(options = {}) {
    this.botId = options.botId
    this.secret = options.secret
    this.logger = options.logger || console
    this.onCallback = typeof options.onCallback === 'function' ? options.onCallback : null
    this.heartbeatIntervalMs = Number(options.heartbeatIntervalMs || 30000)
    this.requestTimeoutMs = Number(options.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS)

    this.ws = null
    this.pending = new Map()
    this.subscribed = false
    this.stopped = false
    this.connectionPromise = null
    this.reconnectTimer = null
    this.pingTimer = null
    this.reconnectAttempts = 0
  }

  async start() {
    if (this.connectionPromise) return this.connectionPromise
    this.stopped = false
    this.connectionPromise = this.#connect()
    return this.connectionPromise
  }

  async stop() {
    this.stopped = true
    this.subscribed = false
    this.connectionPromise = null

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }

    for (const [, pending] of this.pending) {
      pending.reject(new Error('Wecom aibot client stopped'))
      clearTimeout(pending.timer)
    }
    this.pending.clear()

    if (this.ws) {
      try {
        this.ws.close()
      } catch (_) {}
      this.ws = null
    }
  }

  async ensureReady() {
    if (this.subscribed && this.ws?.readyState === WebSocket.OPEN) return
    await this.start()
  }

  async sendCommand(command, timeoutMs = this.requestTimeoutMs) {
    await this.ensureReady()

    const reqId = command?.headers?.req_id || buildWecomReqId('wecom')
    const payload = {
      ...command,
      headers: {
        ...(command.headers || {}),
        req_id: reqId
      }
    }

    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(reqId)
        reject(new Error(`Command timeout: ${payload.cmd}`))
      }, timeoutMs)

      this.pending.set(reqId, { resolve, reject, timer, cmd: payload.cmd })

      try {
        this.ws.send(JSON.stringify(payload))
      } catch (error) {
        clearTimeout(timer)
        this.pending.delete(reqId)
        reject(error)
      }
    })
  }

  async sendMarkdown(chatid, content) {
    return await this.sendCommand({
      cmd: 'aibot_send_msg',
      body: {
        chatid,
        msgtype: 'markdown',
        markdown: {
          content
        }
      }
    })
  }

  async ping() {
    return await this.sendCommand({ cmd: 'ping' }, Math.min(this.requestTimeoutMs, 10000))
  }

  async #connect() {
    if (!this.botId || !this.secret) {
      throw new Error('Missing WECOM_AIBOT_BOT_ID or WECOM_AIBOT_SECRET')
    }

    return await new Promise((resolve, reject) => {
      const ws = new WebSocket(WECOM_AIBOT_WS_URL)
      let settled = false

      const cleanup = ({ keepRuntimeListeners = false } = {}) => {
        ws.removeEventListener('open', handleOpen)
        if (!keepRuntimeListeners) {
          ws.removeEventListener('message', handleMessage)
          ws.removeEventListener('error', handleError)
          ws.removeEventListener('close', handleClose)
        }
      }

      const fail = (error) => {
        if (settled) return
        settled = true
        cleanup()
        try {
          ws.close()
        } catch (_) {}
        if (this.ws === ws) this.ws = null
        this.connectionPromise = null
        reject(error)
      }

      const succeed = () => {
        if (settled) return
        settled = true
        cleanup({ keepRuntimeListeners: true })
        resolve()
      }

      const handleOpen = async () => {
        this.logger.info?.('[wecom-aibot] WebSocket connected, subscribing')
        this.ws = ws
        try {
          await this.#subscribe()
          this.subscribed = true
          this.reconnectAttempts = 0
          this.#startHeartbeat()
          succeed()
        } catch (error) {
          fail(error)
        }
      }

      const handleMessage = (event) => {
        this.#handleIncoming(event.data).catch((error) => {
          this.logger.error?.('[wecom-aibot] Failed to handle message before subscribe:', error)
        })
      }

      const handleError = (event) => {
        const error = event?.error || new Error('WebSocket error')
        if (!settled) {
          fail(error)
        } else {
          this.logger.error?.('[wecom-aibot] WebSocket runtime error:', error)
        }
      }

      const handleClose = (event) => {
        this.subscribed = false
        if (this.pingTimer) {
          clearInterval(this.pingTimer)
          this.pingTimer = null
        }

        if (!settled) {
          fail(new Error(`WebSocket closed before subscribe: ${event?.code || 'unknown'}`))
          return
        }

        this.logger.warn?.('[wecom-aibot] WebSocket closed', { code: event?.code, reason: event?.reason })
        this.ws = null
        this.connectionPromise = null
        this.#rejectAllPending(new Error('WebSocket closed'))

        if (!this.stopped) {
          this.#scheduleReconnect()
        }
      }

      ws.addEventListener('open', handleOpen)
      ws.addEventListener('message', handleMessage)
      ws.addEventListener('error', handleError)
      ws.addEventListener('close', handleClose)
    })
  }

  async #subscribe() {
    const response = await new Promise((resolve, reject) => {
      const reqId = buildWecomReqId('subscribe')
      const timer = setTimeout(() => {
        this.pending.delete(reqId)
        reject(new Error('aibot_subscribe timeout'))
      }, 10000)

      this.pending.set(reqId, { resolve, reject, timer, cmd: 'aibot_subscribe' })
      this.ws.send(JSON.stringify({
        cmd: 'aibot_subscribe',
        headers: {
          req_id: reqId
        },
        body: {
          bot_id: this.botId,
          secret: this.secret
        }
      }))
    })

    return response
  }

  async #handleIncoming(rawMessage) {
    if (!rawMessage) return

    let payload = null
    try {
      payload = JSON.parse(typeof rawMessage === 'string' ? rawMessage : rawMessage.toString())
    } catch (error) {
      this.logger.warn?.('[wecom-aibot] Ignored non-JSON message')
      return
    }

    const reqId = payload?.headers?.req_id
    if (reqId && this.pending.has(reqId)) {
      const pending = this.pending.get(reqId)
      clearTimeout(pending.timer)
      this.pending.delete(reqId)

      if (payload.errcode && payload.errcode !== 0) {
        pending.reject(new Error(payload.errmsg || `errcode=${payload.errcode}`))
      } else {
        pending.resolve(payload)
      }
      return
    }

    if (payload?.cmd?.endsWith('_callback') && this.onCallback) {
      await this.onCallback(payload)
      return
    }

    if (payload?.cmd === 'pong') {
      return
    }

    this.logger.info?.('[wecom-aibot] Received event', payload?.cmd || 'unknown')
  }

  #startHeartbeat() {
    if (this.pingTimer) clearInterval(this.pingTimer)

    this.pingTimer = setInterval(async () => {
      if (this.stopped || !this.subscribed) return
      try {
        await this.ping()
      } catch (error) {
        this.logger.warn?.('[wecom-aibot] Heartbeat failed:', formatErrorMessage(error))
      }
    }, this.heartbeatIntervalMs)
  }

  #scheduleReconnect() {
    if (this.reconnectTimer || this.stopped) return

    const delay = Math.min(30000, 2000 * Math.max(1, this.reconnectAttempts + 1))
    this.reconnectAttempts += 1

    this.logger.warn?.(`[wecom-aibot] Reconnecting in ${delay}ms`)
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      try {
        await wait(50)
        await this.start()
      } catch (error) {
        this.logger.error?.('[wecom-aibot] Reconnect failed:', formatErrorMessage(error))
        this.#scheduleReconnect()
      }
    }, delay)
  }

  #rejectAllPending(error) {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
  }
}
