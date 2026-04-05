import { create } from 'zustand'
import type { DocumentTemplate } from '../types'
import { uid, now } from '../lib/utils'
import { loadData, saveData } from '../services/storage'

interface TemplateState {
  templates: DocumentTemplate[]
  load: () => Promise<void>
  addTemplate: (t: Omit<DocumentTemplate, 'id' | 'createdAt'>) => DocumentTemplate
  deleteTemplate: (id: string) => void
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],

  load: async () => {
    const saved = await loadData<DocumentTemplate[]>('wordly-templates')
    if (saved) set({ templates: saved })
  },

  addTemplate: (t) => {
    const full: DocumentTemplate = { ...t, id: uid(), createdAt: now() }
    set((s) => {
      const templates = [...s.templates, full]
      saveData('wordly-templates', templates)
      return { templates }
    })
    return full
  },

  deleteTemplate: (id) => {
    set((s) => {
      const templates = s.templates.filter((t) => t.id !== id)
      saveData('wordly-templates', templates)
      return { templates }
    })
  },
}))
