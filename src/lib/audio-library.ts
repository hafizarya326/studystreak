/**
 * IndexedDB store for uploaded background tracks.
 *
 * Audio files blow past the ~5 MB localStorage cap, so blobs live here and
 * only track metadata (id, title, order) is kept in user settings via the
 * Repository abstraction. Falls back gracefully when IndexedDB is unavailable
 * (e.g. jsdom).
 */
const DB_NAME = 'studystreak-audio'
const STORE = 'tracks'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = run(tx.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
    tx.oncomplete = () => db.close()
    tx.onabort = () => db.close()
  })
}

function trackKey(userId: string, trackId: string): string {
  // Preserve compatibility with accounts that uploaded a single track before queues existed.
  if (trackId === 'legacy') return userId
  return `${userId}::${trackId}`
}

export async function putTrackItem(userId: string, trackId: string, blob: Blob): Promise<void> {
  await withStore(
    'readwrite',
    (store) => store.put(blob, trackKey(userId, trackId)) as IDBRequest<IDBValidKey>,
  )
}

export async function getTrackItem(userId: string, trackId: string): Promise<Blob | null> {
  try {
    const blob = await withStore<Blob | undefined>('readonly', (store) =>
      store.get(trackKey(userId, trackId)),
    )
    return blob ?? null
  } catch {
    return null
  }
}

export async function deleteTrackItem(userId: string, trackId: string): Promise<void> {
  try {
    await withStore(
      'readwrite',
      (store) => store.delete(trackKey(userId, trackId)) as IDBRequest<undefined>,
    )
  } catch {
    /* nothing stored — fine */
  }
}

/** Delete every uploaded track belonging to a user (both legacy single key and queued tracks). */
export async function deleteUserTracks(userId: string): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const keysReq = store.getAllKeys()
      keysReq.onsuccess = () => {
        const prefix = `${userId}::`
        for (const key of keysReq.result) {
          if (key === userId || (typeof key === 'string' && key.startsWith(prefix))) {
            store.delete(key)
          }
        }
      }
      keysReq.onerror = () => reject(keysReq.error ?? new Error('IndexedDB keys lookup failed'))
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        db.close()
        reject(tx.error ?? new Error('IndexedDB delete failed'))
      }
    })
  } catch {
    /* nothing stored or IndexedDB unavailable — fine */
  }
}

/** Legacy single-track helpers kept for backward compatibility. */
export async function putTrack(userId: string, blob: Blob): Promise<void> {
  await putTrackItem(userId, 'legacy', blob)
}

export async function getTrack(userId: string): Promise<Blob | null> {
  return getTrackItem(userId, 'legacy')
}

export async function deleteTrack(userId: string): Promise<void> {
  await deleteUserTracks(userId)
}
