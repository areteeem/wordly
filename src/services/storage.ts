// Simple localStorage / IndexedDB wrapper
// MVP uses localStorage; can swap to IndexedDB for larger data later

export async function saveData<T>(key: string, data: T): Promise<void> {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    console.warn('Storage save failed for key:', key)
  }
}

export async function loadData<T>(key: string): Promise<T | null> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export async function removeData(key: string): Promise<void> {
  localStorage.removeItem(key)
}
