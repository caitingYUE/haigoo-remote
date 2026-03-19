import dotenv from 'dotenv'

import {
  claimNextWecomPushTask,
  formatApprovedJobMarkdown,
  markWecomPushTaskFailed,
  markWecomPushTaskSent,
  rememberWecomGroupChat,
  resolveWecomTargetChatId
} from '../lib/services/wecom-aibot-queue-service.js'
import { WecomAibotClient } from '../lib/services/wecom-aibot-client.js'

dotenv.config({ path: '.env.local' })
dotenv.config()

const BOT_ID = process.env.WECOM_AIBOT_BOT_ID
const BOT_SECRET = process.env.WECOM_AIBOT_SECRET
const SITE_URL = process.env.SITE_URL || 'https://haigooremote.com'
const POLL_INTERVAL_MS = Number(process.env.WECOM_AIBOT_QUEUE_POLL_INTERVAL_MS || 5000)
const RUN_ONCE = process.argv.includes('--once')

if (!BOT_ID || !BOT_SECRET) {
  console.error('Missing WECOM_AIBOT_BOT_ID or WECOM_AIBOT_SECRET')
  process.exit(1)
}

let stopped = false

const client = new WecomAibotClient({
  botId: BOT_ID,
  secret: BOT_SECRET,
  onCallback: async (payload) => {
    if (payload?.cmd === 'aibot_msg_callback' && payload?.body?.chattype === 'group' && payload?.body?.chatid) {
      await rememberWecomGroupChat(payload.body.chatid)
      console.log(`[wecom-aibot] learned group chatid ${payload.body.chatid}`)
    }
  }
})

async function processOneTask() {
  const task = await claimNextWecomPushTask()
  if (!task) return false

  try {
    const chatid = await resolveWecomTargetChatId(task.payload?.chatid || null)
    if (!chatid) {
      throw new Error('No target group chatid found. Set WECOM_AIBOT_CHAT_ID or @机器人 once in the target group after worker starts.')
    }

    const markdown = formatApprovedJobMarkdown(task.payload, { siteUrl: SITE_URL })
    const response = await client.sendMarkdown(chatid, markdown)

    await markWecomPushTaskSent(task.id, response)
    console.log(`[wecom-aibot] pushed approved job ${task.job_id || task.payload?.jobId} to ${chatid}`)
    return true
  } catch (error) {
    await markWecomPushTaskFailed(task, error)
    console.error(`[wecom-aibot] push failed for task ${task.id}:`, error.message)
    return true
  }
}

async function main() {
  await client.start()
  console.log('[wecom-aibot] worker started')

  if (RUN_ONCE) {
    await processOneTask()
    await client.stop()
    return
  }

  while (!stopped) {
    const handled = await processOneTask()
    if (!handled) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }
  }
}

process.on('SIGINT', async () => {
  stopped = true
  await client.stop()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  stopped = true
  await client.stop()
  process.exit(0)
})

main().catch(async (error) => {
  console.error('[wecom-aibot] worker crashed:', error)
  await client.stop()
  process.exit(1)
})
