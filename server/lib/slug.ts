import { randomInt } from 'node:crypto'

/** No 0/O/1/l/I: a short code has to survive being read off a screen out loud. */
const ALPHABET = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'

export function generateCode(length = 7): string {
  let out = ''
  for (let i = 0; i < length; i += 1) out += ALPHABET[randomInt(ALPHABET.length)]
  return out
}

const RESERVED = new Set([
  'api', 'r', 'assets', 'static', 'favicon.ico', 'robots.txt', 'health',
  'login', 'logout', 'register', 'dashboard', 'admin', 'index.html', 'manifest.json',
])

export function isReservedCode(code: string): boolean {
  return RESERVED.has(code.toLowerCase())
}

export const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/

export function isValidCode(code: string): boolean {
  return CODE_PATTERN.test(code) && !isReservedCode(code)
}
