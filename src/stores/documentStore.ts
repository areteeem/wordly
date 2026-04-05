import { create } from 'zustand'
import type { Document } from '../types'
import { INBOX_FOLDER_ID } from '../types'
import { uid, now } from '../lib/utils'
import { loadData, saveData } from '../services/storage'

interface DocumentState {
  documents: Document[]
  activeDocumentId: string | null
  saveStatus: 'saved' | 'saving' | 'unsaved'
  load: () => Promise<void>
  createDocument: (folderId?: string) => Document
  createDocumentFromTemplate: (templateContent: string, templateTags: string[], templateName: string, folderId?: string) => Document
  updateContent: (id: string, content: string) => void
  updateTitle: (id: string, title: string) => void
  deleteDocument: (id: string) => void
  setActiveDocument: (id: string | null) => void
  getActiveDocument: () => Document | undefined
  moveDocument: (id: string, folderId: string) => void
  updateTags: (id: string, tags: string[]) => void
  scrollToPosition: number | null
  setScrollToPosition: (pos: number | null) => void
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  activeDocumentId: null,
  saveStatus: 'saved',
  scrollToPosition: null,

  load: async () => {
    const saved = await loadData<Document[]>('wordly-documents')
    if (saved) set({ documents: saved })
  },

  createDocument: (folderId) => {
    const doc: Document = {
      id: uid(),
      title: 'Untitled',
      content: '',
      folderId: folderId ?? INBOX_FOLDER_ID,
      tags: [],
      createdAt: now(),
      updatedAt: now(),
    }
    set((s) => {
      const documents = [...s.documents, doc]
      saveData('wordly-documents', documents)
      return { documents, activeDocumentId: doc.id }
    })
    return doc
  },

  createDocumentFromTemplate: (templateContent, templateTags, templateName, folderId) => {
    const doc: Document = {
      id: uid(),
      title: `${templateName} (copy)`,
      content: templateContent,
      folderId: folderId ?? INBOX_FOLDER_ID,
      tags: [...templateTags],
      createdAt: now(),
      updatedAt: now(),
    }
    set((s) => {
      const documents = [...s.documents, doc]
      saveData('wordly-documents', documents)
      return { documents, activeDocumentId: doc.id }
    })
    return doc
  },

  updateContent: (id, content) => {
    set((s) => {
      const documents = s.documents.map((d) =>
        d.id === id ? { ...d, content, updatedAt: now() } : d,
      )
      return { documents, saveStatus: 'saving' as const }
    })

    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      saveData('wordly-documents', get().documents)
      set({ saveStatus: 'saved' })
    }, 2000)
  },

  updateTitle: (id, title) => {
    set((s) => {
      const documents = s.documents.map((d) =>
        d.id === id ? { ...d, title, updatedAt: now() } : d,
      )
      saveData('wordly-documents', documents)
      return { documents }
    })
  },

  deleteDocument: (id) => {
    set((s) => {
      const documents = s.documents.filter((d) => d.id !== id)
      const activeDocumentId = s.activeDocumentId === id ? null : s.activeDocumentId
      saveData('wordly-documents', documents)
      return { documents, activeDocumentId }
    })
  },

  setActiveDocument: (id) => set({ activeDocumentId: id }),

  getActiveDocument: () => {
    const { documents, activeDocumentId } = get()
    return documents.find((d) => d.id === activeDocumentId)
  },

  moveDocument: (id, folderId) => {
    set((s) => {
      const documents = s.documents.map((d) =>
        d.id === id ? { ...d, folderId, updatedAt: now() } : d,
      )
      saveData('wordly-documents', documents)
      return { documents }
    })
  },

  updateTags: (id, tags) => {
    set((s) => {
      const documents = s.documents.map((d) =>
        d.id === id ? { ...d, tags, updatedAt: now() } : d,
      )
      saveData('wordly-documents', documents)
      return { documents }
    })
  },

  setScrollToPosition: (pos) => set({ scrollToPosition: pos }),
}))
