/**
 * Credential hashing helper.
 *
 * This is a local-first app: credentials never leave the device, but we still
 * avoid storing plaintext passwords. New passwords use **PBKDF2-SHA256** (slow,
 * salted, 210k iterations) which resists offline brute force far better than a
 * single SHA-256 pass. Legacy single-pass hashes (`sha256:` / `h:`) still
 * verify so existing local accounts keep working and are automatically upgraded
 * on the next successful sign-in.
 *
 * When Supabase (or any real backend) is wired in, replace these calls with the
 * provider's auth — the rest of the app never touches password material.
 */

const encoder = new TextEncoder()
export const PBKDF2_ITERATIONS = 210_000
const MIN_PBKDF2_ITERATIONS = 100_000
const MAX_PBKDF2_ITERATIONS = 2_000_000
const DUMMY_SALT = '00000000000000000000000000000000'

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Constant-time-ish string compare (no early exit on mismatch or length difference). */
function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return diff === 0
}

/** Deterministic fallback for environments without WebCrypto (e.g. non-secure origins). */
function fallbackHash(input: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (((h2 >>> 0) * 4294967296 + (h1 >>> 0)) >>> 0).toString(16) + (h1 >>> 0).toString(16)
}

/** Pre-PBKDF2 hash, kept only to verify accounts created before the upgrade. */
function legacyHash(password: string, salt: string): string {
  const input = `studystreak::${salt}::${password}`
  return `h:${fallbackHash(input)}`
}

async function legacySha256(password: string, salt: string): Promise<string> {
  const input = `studystreak::${salt}::${password}`
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input))
  return `sha256:${toHex(digest)}`
}

async function derivePbkdf2(password: string, salt: string, iterations: number): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto subtle API unavailable')
  }
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(`studystreak::${salt}`),
      iterations,
      hash: 'SHA-256',
    },
    key,
    256,
  )
  return `pbkdf2:${iterations}:${toHex(bits)}`
}

export function makeSalt(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  try {
    return await derivePbkdf2(password, salt, PBKDF2_ITERATIONS)
  } catch {
    /* fall through only when WebCrypto is unavailable (e.g. non-secure dev context) */
  }
  return legacyHash(password, salt)
}

/** True when a stored hash uses a legacy algorithm or fewer iterations than current policy. */
export function needsRehash(expected: string): boolean {
  const match = expected.match(/^pbkdf2:(\d+):[0-9a-f]{64}$/)
  if (!match) return true
  const iterations = Number(match[1])
  return !Number.isInteger(iterations) || iterations < PBKDF2_ITERATIONS
}

export async function verifyPassword(
  password: string,
  salt: string,
  expected: string,
): Promise<boolean> {
  if (expected.startsWith('pbkdf2:')) {
    const match = expected.match(/^pbkdf2:(\d+):([0-9a-f]{64})$/)
    if (!match) return false
    const iterations = Number(match[1])
    if (
      !Number.isInteger(iterations) ||
      iterations < MIN_PBKDF2_ITERATIONS ||
      iterations > MAX_PBKDF2_ITERATIONS
    ) {
      return false
    }
    try {
      const derived = await derivePbkdf2(password, salt, iterations)
      return safeEqual(derived, expected)
    } catch {
      // Fail closed — never fall back to a weak hash when verifying PBKDF2.
      return false
    }
  }
  if (expected.startsWith('sha256:')) {
    try {
      return safeEqual(await legacySha256(password, salt), expected)
    } catch {
      return false
    }
  }
  if (expected.startsWith('h:')) {
    return safeEqual(legacyHash(password, salt), expected)
  }
  return false
}

/**
 * Perform the same PBKDF2 work as a real login check so non-existent emails do
 * not return noticeably faster than wrong passwords (prevents timing enumeration).
 */
export async function dummyPasswordWork(password: string): Promise<void> {
  try {
    await derivePbkdf2(password.slice(0, 128), DUMMY_SALT, PBKDF2_ITERATIONS)
  } catch {
    /* ignore when WebCrypto unavailable */
  }
}
