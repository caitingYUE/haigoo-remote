import { spawn } from 'node:child_process'

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const viteArgs = process.argv.slice(2)

const runApiArgs = ['run', 'server:api']
const runWebArgs = ['run', 'dev:web']

if (viteArgs.length > 0) {
  runWebArgs.push('--', ...viteArgs)
}

const apiProcess = spawn(npmCmd, runApiArgs, {
  stdio: 'inherit',
  env: process.env
})

const webProcess = spawn(npmCmd, runWebArgs, {
  stdio: 'inherit',
  env: process.env
})

let shuttingDown = false

function terminateChildren() {
  if (apiProcess.pid && !apiProcess.killed) {
    apiProcess.kill('SIGTERM')
  }
  if (webProcess.pid && !webProcess.killed) {
    webProcess.kill('SIGTERM')
  }
}

function shutdownAndExit(code) {
  if (shuttingDown) return
  shuttingDown = true
  terminateChildren()
  process.exit(code)
}

apiProcess.on('exit', (code, signal) => {
  if (shuttingDown) return
  const exitCode = code ?? (signal ? 1 : 0)
  console.error(`[dev] API server exited unexpectedly (code=${exitCode}).`)
  shutdownAndExit(exitCode || 1)
})

webProcess.on('exit', (code, signal) => {
  if (shuttingDown) return
  const exitCode = code ?? (signal ? 1 : 0)
  shutdownAndExit(exitCode)
})

process.on('SIGINT', () => shutdownAndExit(0))
process.on('SIGTERM', () => shutdownAndExit(0))
process.on('uncaughtException', (err) => {
  console.error('[dev] Uncaught exception:', err)
  shutdownAndExit(1)
})
