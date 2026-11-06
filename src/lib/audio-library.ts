/**
 * IndexedDB store for uploaded background tracks.
 *
 * Audio files blow past the ~5 MB localStorage cap, so the blob lives here and
 * only the display name is kept in settings. Falls back to null when IndexedDB
 * is unavailable (e.g. jsdom), which the caller treats as "no upload".
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
  })
}

export async function putTrack(userId: string, blob: Blob): Promise<void> {
  await withStore('readwrite', (store) => store.put(blob, userId) as IDBRequest<IDBValidKey>)
}

export async function getTrack(userId: string): Promise<Blob | null> {
  try {
    const blob = await withStore<Blob | undefined>('readonly', (store) => store.get(userId))
    return blob ?? null
  } catch {
    return null
  }
}

export async function deleteTrack(userId: string): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.delete(userId) as IDBRequest<undefined>)
  } catch {
    /* nothing stored — fine */
  }
}
