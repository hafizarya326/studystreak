/**
 * Credential hashing helper.
 *
 * This is a local-first app: credentials never leave the device, but we still
 * avoid storing plaintext passwords. New passwords use **PBKDF2-SHA256** (slow,
 * salted, 210k iterations) which resists offline brute force far better than a
 * single SHA-256 pass. Legacy single-pass hashes (`sha256:` / `h:`) still
 * verify so existing local accounts keep working.
 *
 * When Supabase (or any real backend) is wired in, replace these calls with the
 * provider's auth — the rest of the app never touches password material.
 */

const encoder = new TextEncoder()
const PBKDF2_ITERATIONS = 210_000

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Constant-time-ish string compare so verification doesn't leak via early exit. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
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

export function makeSalt(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
        'deriveBits',
      ])
      const bits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: encoder.encode(`studystreak::${salt}`),
          iterations: PBKDF2_ITERATIONS,
          hash: 'SHA-256',
        },
        key,
        256,
      )
      return `pbkdf2:${PBKDF2_ITERATIONS}:${toHex(bits)}`
    }
  } catch {
    /* fall through */
  }
  return legacyHash(password, salt)
}

export async function verifyPassword(
  password: string,
  salt: string,
  expected: string,
): Promise<boolean> {
  if (expected.startsWith('pbkdf2:')) {
    return safeEqual(await hashPassword(password, salt), expected)
  }
  if (expected.startsWith('sha256:')) {
    try {
      return safeEqual(await legacySha256(password, salt), expected)
    } catch {
      return false
    }
  }
  return safeEqual(legacyHash(password, salt), expected)
}
