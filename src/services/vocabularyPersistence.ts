import { get, set } from 'idb-keyval'
import { createVocabularySnapshot, normalizeVocabularyEntries, mergeVocabularyEntries } from '../lib/vocabulary'
import type { VocabularyEntry, VocabularySnapshot } from '../types'
import { uid } from '../lib/utils'

const SNAPSHOT_KEY = 'wordly-vocabulary-state'
const LEGACY_KEY = 'wordly-vocabulary'
const DEVICE_KEY = 'wordly-device-id'
const CHANNEL_NAME = 'wordly-vocabulary-sync'

function hasWindow() {
  return typeof window !== 'undefined'
}

function readLocalStorage<T>(key: string): T | null {
  if (!hasWindow()) return null

  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

async function writeEverywhere<T>(key: string, value: T) {
  await set(key, value)

  if (!hasWindow()) return

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore localStorage mirror failures when IndexedDB succeeds.
  }
}

export function getVocabularyDeviceId(): string {
  const fallback = `device-${uid()}`
  if (!hasWindow()) return fallback

  try {
    const existing = window.localStorage.getItem(DEVICE_KEY)
    if (existing) return existing
    const next = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : fallback
    window.localStorage.setItem(DEVICE_KEY, next)
    return next
  } catch {
    return fallback
  }
}

function isSnapshot(value: unknown): value is VocabularySnapshot {
  if (!value || typeof value !== 'object') return false
  const candidate = value as VocabularySnapshot
  return Array.isArray(candidate.entries) && typeof candidate.version === 'number'
}

function mergeSnapshots(localSnapshot: VocabularySnapshot, incomingSnapshot: VocabularySnapshot): VocabularySnapshot {
  const merged = new Map<string, VocabularyEntry>()

  for (const entry of normalizeVocabularyEntries(localSnapshot.entries)) {
    merged.set(entry.normalizedWord, entry)
  }

  for (const entry of normalizeVocabularyEntries(incomingSnapshot.entries)) {
    const existing = merged.get(entry.normalizedWord)
    merged.set(entry.normalizedWord, existing ? mergeVocabularyEntries(existing, entry) : entry)
  }

  const versionBase = Math.max(localSnapshot.version, incomingSnapshot.version)
  const updatedAt = Math.max(localSnapshot.updatedAt, incomingSnapshot.updatedAt)

  return {
    schemaVersion: Math.max(localSnapshot.schemaVersion, incomingSnapshot.schemaVersion),
    version: versionBase + 1,
    updatedAt,
    deviceId: incomingSnapshot.deviceId,
    entries: Array.from(merged.values()).sort((left, right) => right.updatedAt - left.updatedAt),
  }
}

export async function loadVocabularySnapshot(): Promise<VocabularySnapshot> {
  const deviceId = getVocabularyDeviceId()

  try {
    const snapshot = await get<VocabularySnapshot>(SNAPSHOT_KEY)
    if (isSnapshot(snapshot)) {
      return {
        ...snapshot,
        deviceId: snapshot.deviceId || deviceId,
        entries: normalizeVocabularyEntries(snapshot.entries),
      }
    }
  } catch {
    // Fall back to localStorage or legacy data.
  }

  const localSnapshot = readLocalStorage<VocabularySnapshot>(SNAPSHOT_KEY)
  if (isSnapshot(localSnapshot)) {
    return {
      ...localSnapshot,
      deviceId: localSnapshot.deviceId || deviceId,
      entries: normalizeVocabularyEntries(localSnapshot.entries),
    }
  }

  const legacyEntries = readLocalStorage<VocabularyEntry[]>(LEGACY_KEY) || []
  return createVocabularySnapshot(normalizeVocabularyEntries(legacyEntries), 1, deviceId)
}

export async function saveVocabularySnapshot(snapshot: VocabularySnapshot): Promise<void> {
  const normalizedSnapshot: VocabularySnapshot = {
    ...snapshot,
    deviceId: snapshot.deviceId || getVocabularyDeviceId(),
    entries: normalizeVocabularyEntries(snapshot.entries),
  }

  await writeEverywhere(SNAPSHOT_KEY, normalizedSnapshot)

  if (!hasWindow()) return

  try {
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.postMessage(normalizedSnapshot)
    channel.close()
  } catch {
    // BroadcastChannel is optional.
  }
}

export function subscribeToVocabularySnapshots(
  onSnapshot: (snapshot: VocabularySnapshot) => void,
): () => void {
  if (!hasWindow()) return () => undefined

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== SNAPSHOT_KEY || !event.newValue) return

    try {
      const parsed = JSON.parse(event.newValue) as VocabularySnapshot
      if (isSnapshot(parsed)) {
        onSnapshot({ ...parsed, entries: normalizeVocabularyEntries(parsed.entries) })
      }
    } catch {
      // Ignore malformed snapshots.
    }
  }

  window.addEventListener('storage', handleStorage)

  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event: MessageEvent<VocabularySnapshot>) => {
      if (isSnapshot(event.data)) {
        onSnapshot({ ...event.data, entries: normalizeVocabularyEntries(event.data.entries) })
      }
    }
  } catch {
    channel = null
  }

  return () => {
    window.removeEventListener('storage', handleStorage)
    channel?.close()
  }
}

export async function mergeAndSaveVocabularySnapshot(
  localSnapshot: VocabularySnapshot,
  incomingSnapshot: VocabularySnapshot,
): Promise<VocabularySnapshot> {
  const merged = mergeSnapshots(localSnapshot, incomingSnapshot)
  await saveVocabularySnapshot(merged)
  return merged
}