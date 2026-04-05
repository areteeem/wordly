import { create } from 'zustand'
import type { VocabularyEntry } from '../types'
import { uid, now } from '../lib/utils'
import { loadData, saveData } from '../services/storage'

interface VocabularyState {
  entries: VocabularyEntry[]
  lastDeleted: VocabularyEntry | null
  load: () => Promise<void>
  addEntry: (entry: Omit<VocabularyEntry, 'id' | 'createdAt' | 'updatedAt' | 'starred' | 'mastery'>) => VocabularyEntry
  updateEntry: (id: string, updates: Partial<VocabularyEntry>) => void
  deleteEntry: (id: string) => void
  undoDelete: () => void
  toggleStar: (id: string) => void
  getEntriesForDocument: (docId: string) => VocabularyEntry[]
  hasDuplicate: (word: string, docId: string) => boolean
}

export const useVocabularyStore = create<VocabularyState>((set, get) => ({
  entries: [],
  lastDeleted: null,

  load: async () => {
    const saved = await loadData<VocabularyEntry[]>('wordly-vocabulary')
    if (saved) {
      // Migrate old entries without starred/mastery fields
      const migrated = saved.map((e) => ({
        ...e,
        starred: e.starred ?? false,
        mastery: e.mastery ?? 'learning' as const,
      }))
      set({ entries: migrated })
    }
  },

  addEntry: (entry) => {
    const full: VocabularyEntry = {
      ...entry,
      id: uid(),
      starred: false,
      mastery: 'learning',
      createdAt: now(),
      updatedAt: now(),
    }
    set((s) => {
      const entries = [...s.entries, full]
      saveData('wordly-vocabulary', entries)
      return { entries }
    })
    return full
  },

  updateEntry: (id, updates) => {
    set((s) => {
      const entries = s.entries.map((e) =>
        e.id === id ? { ...e, ...updates, updatedAt: now() } : e,
      )
      saveData('wordly-vocabulary', entries)
      return { entries }
    })
  },

  deleteEntry: (id) => {
    const entry = get().entries.find((e) => e.id === id)
    set((s) => {
      const entries = s.entries.filter((e) => e.id !== id)
      saveData('wordly-vocabulary', entries)
      return { entries, lastDeleted: entry || null }
    })
  },

  undoDelete: () => {
    const { lastDeleted } = get()
    if (!lastDeleted) return
    set((s) => {
      const entries = [...s.entries, lastDeleted]
      saveData('wordly-vocabulary', entries)
      return { entries, lastDeleted: null }
    })
  },

  toggleStar: (id) => {
    set((s) => {
      const entries = s.entries.map((e) =>
        e.id === id ? { ...e, starred: !e.starred, updatedAt: now() } : e,
      )
      saveData('wordly-vocabulary', entries)
      return { entries }
    })
  },

  getEntriesForDocument: (docId) => {
    return get().entries.filter((e) => e.documentId === docId)
  },

  hasDuplicate: (word, docId) => {
    return get().entries.some(
      (e) => e.word.toLowerCase() === word.toLowerCase() && e.documentId === docId,
    )
  },
}))
