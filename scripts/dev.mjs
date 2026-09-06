#!/usr/bin/env node
/**
 * One command for both halves: the Hono API on 8787 and the Vite dashboard on
 * 5173. Kills both when either one dies, so a crashed server never leaves a
 * stale dev server behind.
 */
import { spawn } from 'node:child_process'

const ESC = String.fromCharCode(27)
const paint = (code, text) => `${ESC}[${code}m${text}${ESC}[0m`

const processes = []
let shuttingDown = false

const stop = (code) => {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of processes) child.kill('SIGTERM')
  setTimeout(() => process.exit(code), 150)
}

const run = (name, command, args, color) => {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
  })
  const prefix = `${paint(color, name.padEnd(6))} | `
  const pipe = (stream) => {
    stream.setEncoding('utf8')
    let buffer = ''
    stream.on('data', (chunk) => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) process.stdout.write(`${prefix}${line}\n`)
    })
  }
  pipe(child.stdout)
  pipe(child.stderr)
  child.on('exit', (code) => {
    if (shuttingDown) return
    process.stdout.write(`${prefix}exited with code ${code}\n`)
    stop(code ?? 1)
  })
  processes.push(child)
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))

run('api', 'npx', ['tsx', 'watch', '--clear-screen=false', 'server/index.ts'], '36')
run('web', 'npx', ['vite'], '35')
