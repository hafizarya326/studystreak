/** Cryptographically strong, collision-resistant ids for local data. */
export function uid(prefix = ''): string {
  let rand: string
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    rand = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  } else if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(8)
    crypto.getRandomValues(bytes)
    rand = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } else {
    rand = Math.random().toString(36).slice(2, 14)
  }
  return `${prefix}${Date.now().toString(36)}_${rand}`
}
