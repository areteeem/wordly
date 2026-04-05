import { create } from 'zustand'
import type { AppSettings, Notification } from '../types'
import { DEFAULT_SETTINGS } from '../types'
import { uid } from '../lib/utils'
import { loadData, saveData } from '../services/storage'

interface SettingsState {
  settings: AppSettings
  settingsOpen: boolean
  notifications: Notification[]
  load: () => Promise<void>
  updateSettings: (updates: Partial<AppSettings>) => void
  toggleSettings: () => void
  notify: (message: string, type?: Notification['type']) => void
  dismissNotification: (id: string) => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  settingsOpen: false,
  notifications: [],

  load: async () => {
    const saved = await loadData<AppSettings>('wordly-settings')
    if (saved) set({ settings: { ...DEFAULT_SETTINGS, ...saved } })
  },

  updateSettings: (updates) => {
    set((s) => {
      const settings = { ...s.settings, ...updates }
      saveData('wordly-settings', settings)
      return { settings }
    })
  },

  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),

  notify: (message, type = 'success') => {
    const n: Notification = { id: uid(), message, type }
    set((s) => ({ notifications: [...s.notifications, n] }))
    setTimeout(() => {
      set((s) => ({ notifications: s.notifications.filter((x) => x.id !== n.id) }))
    }, 3000)
  },

  dismissNotification: (id) => {
    set((s) => ({ notifications: s.notifications.filter((x) => x.id !== id) }))
  },
}))
