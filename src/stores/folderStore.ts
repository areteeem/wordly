import { create } from 'zustand'
import type { Folder } from '../types'
import { INBOX_FOLDER_ID } from '../types'
import { uid, now } from '../lib/utils'
import { loadData, saveData } from '../services/storage'

interface FolderState {
  folders: Folder[]
  activeFolderId: string
  load: () => Promise<void>
  addFolder: (name: string, parentId?: string | null) => Folder
  renameFolder: (id: string, name: string) => void
  deleteFolder: (id: string) => void
  setActiveFolder: (id: string) => void
}

const inboxFolder: Folder = {
  id: INBOX_FOLDER_ID,
  name: 'Inbox',
  parentId: null,
  createdAt: 0,
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: [inboxFolder],
  activeFolderId: INBOX_FOLDER_ID,

  load: async () => {
    const saved = await loadData<Folder[]>('wordly-folders')
    if (saved && saved.length > 0) {
      const hasInbox = saved.some((f) => f.id === INBOX_FOLDER_ID)
      set({ folders: hasInbox ? saved : [inboxFolder, ...saved] })
    }
  },

  addFolder: (name, parentId = null) => {
    const folder: Folder = { id: uid(), name, parentId: parentId ?? null, createdAt: now() }
    set((s) => {
      const folders = [...s.folders, folder]
      saveData('wordly-folders', folders)
      return { folders }
    })
    return folder
  },

  renameFolder: (id, name) => {
    set((s) => {
      const folders = s.folders.map((f) => (f.id === id ? { ...f, name } : f))
      saveData('wordly-folders', folders)
      return { folders }
    })
  },

  deleteFolder: (id) => {
    if (id === INBOX_FOLDER_ID) return
    set((s) => {
      const folders = s.folders.filter((f) => f.id !== id && f.parentId !== id)
      const activeFolderId = s.activeFolderId === id ? INBOX_FOLDER_ID : s.activeFolderId
      saveData('wordly-folders', folders)
      return { folders, activeFolderId }
    })
  },

  setActiveFolder: (id) => set({ activeFolderId: id }),
}))
