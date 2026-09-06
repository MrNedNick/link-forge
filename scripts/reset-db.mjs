#!/usr/bin/env node
/** Drops the local database directory, then migrates and seeds it from scratch. */
import { rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

await rm('./.data', { recursive: true, force: true })
console.log('local database removed')

for (const script of ['db:migrate', 'db:seed']) {
  const result = spawnSync('npm', ['run', script], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
