/**
 * Tiny credential hashing helper.
 *
 * This is a local-first app: credentials never leave the device, but we still
 * avoid storing plaintext passwords. When Supabase (or any real backend) is
 * wired in, replace these calls with the provider's auth — the rest of the app
 * never touches password material directly.
 */

const encoder = new TextEncoder()

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
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

export function makeSalt(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const input = `studystreak::${salt}::${password}`
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input))
      return `sha256:${toHex(digest)}`
    }
  } catch {
    /* fall through */
  }
  return `h:${fallbackHash(input)}`
}

export async function verifyPassword(
  password: string,
  salt: string,
  expected: string,
): Promise<boolean> {
  const actual = await hashPassword(password, salt)
  return actual === expected
}
