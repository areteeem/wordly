import { create } from 'zustand'
import type {
  FlashcardCardType,
  FlashcardPrompt,
  ReviewGrade,
  VocabularyEntry,
  VocabularyEntryInput,
  VocabScope,
} from '../types'
import { now } from '../lib/utils'
import {
  appendVocabularyOccurrence,
  applyReviewResult,
  buildFlashcardPrompts,
  buildVocabularyRecommendations,
  createVocabularyEntry,
  createVocabularySnapshot,
  ensureVocabularyEntry,
  normalizeVocabularyEntries,
  normalizeVocabularyWord,
  updateVocabularyEntry,
} from '../lib/vocabulary'
import {
  getVocabularyDeviceId,
  loadVocabularySnapshot,
  mergeAndSaveVocabularySnapshot,
  saveVocabularySnapshot,
  subscribeToVocabularySnapshots,
} from '../services/vocabularyPersistence'

interface VocabularyState {
  entries: VocabularyEntry[]
  lastDeleted: VocabularyEntry | null
  snapshotVersion: number
  load: () => Promise<void>
  addEntry: (entry: VocabularyEntryInput) => VocabularyEntry
  updateEntry: (id: string, updates: Partial<VocabularyEntry>) => void
  deleteEntry: (id: string) => void
  undoDelete: () => void
  toggleStar: (id: string) => void
  getEntriesForDocument: (docId: string) => VocabularyEntry[]
  hasDuplicate: (word: string, docId?: string, scope?: VocabScope) => boolean
  reviewEntry: (id: string, grade: ReviewGrade, cardType: FlashcardCardType) => void
  getDueFlashcards: (documentId?: string, limit?: number) => FlashcardPrompt[]
  getRecommendations: (documentId?: string, limit?: number) => VocabularyEntry[]
}

let syncUnsubscribe: (() => void) | null = null

function persistEntries(entries: VocabularyEntry[], snapshotVersion: number) {
  const snapshot = createVocabularySnapshot(entries, snapshotVersion + 1, getVocabularyDeviceId())
  void saveVocabularySnapshot(snapshot)
  return snapshot
}

export const useVocabularyStore = create<VocabularyState>((set, get) => ({
  entries: [],
  lastDeleted: null,
  snapshotVersion: 0,

  load: async () => {
    const snapshot = await loadVocabularySnapshot()
    const entries = normalizeVocabularyEntries(snapshot.entries.map((entry) => ensureVocabularyEntry(entry)))
    set({ entries, snapshotVersion: snapshot.version })

    if (!syncUnsubscribe) {
      syncUnsubscribe = subscribeToVocabularySnapshots(async (incomingSnapshot) => {
        if (incomingSnapshot.deviceId === getVocabularyDeviceId()) return

        const current = get()
        const localSnapshot = createVocabularySnapshot(current.entries, current.snapshotVersion, getVocabularyDeviceId())
        const mergedSnapshot = await mergeAndSaveVocabularySnapshot(localSnapshot, incomingSnapshot)
        set({ entries: mergedSnapshot.entries, snapshotVersion: mergedSnapshot.version })
      })
    }
  },

  addEntry: (entry) => {
    const timestamp = now()
    const normalizedWord = normalizeVocabularyWord(entry.word)
    const existing = get().entries.find((candidate) => candidate.normalizedWord === normalizedWord)
    const nextEntry = existing
      ? appendVocabularyOccurrence(existing, entry, timestamp)
      : createVocabularyEntry(entry, timestamp)

    set((state) => {
      const entries = existing
        ? state.entries.map((candidate) => (candidate.id === existing.id ? nextEntry : candidate))
        : [nextEntry, ...state.entries]
      const snapshot = persistEntries(entries, state.snapshotVersion)
      return { entries: snapshot.entries, snapshotVersion: snapshot.version }
    })

    return nextEntry
  },

  updateEntry: (id, updates) => {
    set((state) => {
      const entry = state.entries.find((candidate) => candidate.id === id)
      if (!entry) return state

      const updatedEntry = updateVocabularyEntry(entry, updates, now())
      const conflictingEntry = state.entries.find(
        (candidate) => candidate.id !== id && candidate.normalizedWord === updatedEntry.normalizedWord,
      )

      let entries = state.entries.map((candidate) => (candidate.id === id ? updatedEntry : candidate))
      if (conflictingEntry) {
        const mergedEntry = appendVocabularyOccurrence(conflictingEntry, {
          word: updatedEntry.word,
          translation: updatedEntry.translation,
          contextSentence: updatedEntry.contextSentence,
          notes: updatedEntry.notes,
          tags: updatedEntry.tags,
          positionInDoc: updatedEntry.positionInDoc,
          documentId: updatedEntry.documentId,
          translationSource: updatedEntry.translationSource,
        }, now())

        entries = entries
          .filter((candidate) => candidate.id !== id && candidate.id !== conflictingEntry.id)
          .concat(mergedEntry)
      }

      const snapshot = persistEntries(entries, state.snapshotVersion)
      return { entries: snapshot.entries, snapshotVersion: snapshot.version }
    })
  },

  deleteEntry: (id) => {
    const entry = get().entries.find((e) => e.id === id)
    set((state) => {
      const entries = state.entries.filter((candidate) => candidate.id !== id)
      const snapshot = persistEntries(entries, state.snapshotVersion)
      return { entries: snapshot.entries, snapshotVersion: snapshot.version, lastDeleted: entry || null }
    })
  },

  undoDelete: () => {
    const { lastDeleted } = get()
    if (!lastDeleted) return
    set((state) => {
      const entries = normalizeVocabularyEntries([...state.entries, lastDeleted])
      const snapshot = persistEntries(entries, state.snapshotVersion)
      return { entries: snapshot.entries, snapshotVersion: snapshot.version, lastDeleted: null }
    })
  },

  toggleStar: (id) => {
    set((state) => {
      const entries = state.entries.map((candidate) =>
        candidate.id === id
          ? updateVocabularyEntry(candidate, { starred: !candidate.starred }, now())
          : candidate,
      )
      const snapshot = persistEntries(entries, state.snapshotVersion)
      return { entries: snapshot.entries, snapshotVersion: snapshot.version }
    })
  },

  getEntriesForDocument: (docId) => {
    return get().entries.filter((entry) => entry.occurrences.some((occurrence) => occurrence.documentId === docId))
  },

  hasDuplicate: (word, docId, scope = 'all') => {
    const normalizedWord = normalizeVocabularyWord(word)
    return get().entries.some((entry) => {
      if (entry.normalizedWord !== normalizedWord) return false
      if (scope === 'all') return true
      if (!docId) return false
      if (scope === 'file') {
        return entry.occurrences.some((occurrence) => occurrence.documentId === docId)
      }
      return entry.documentId === docId || entry.occurrences.some((occurrence) => occurrence.documentId === docId)
    })
  },

  reviewEntry: (id, grade, cardType) => {
    set((state) => {
      const entries = state.entries.map((entry) =>
        entry.id === id ? applyReviewResult(entry, grade, cardType, now()) : entry,
      )
      const snapshot = persistEntries(entries, state.snapshotVersion)
      return { entries: snapshot.entries, snapshotVersion: snapshot.version }
    })
  },

  getDueFlashcards: (documentId, limit = 24) => {
    return buildFlashcardPrompts(get().entries, {
      documentId,
      limit,
      dueOnly: true,
    })
  },

  getRecommendations: (documentId, limit = 8) => {
    return buildVocabularyRecommendations(get().entries, { documentId, limit })
  },
}))
