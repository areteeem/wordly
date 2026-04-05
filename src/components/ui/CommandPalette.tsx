import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Search,
  FilePlus,
  FolderPlus,
  Settings,
  BookOpen,
  FileText,
  Sun,
  Moon,
  Download,
  Folder,
  BookA,
} from 'lucide-react'
import { useDocumentStore } from '../../stores/documentStore'
import { useFolderStore } from '../../stores/folderStore'
import { useVocabularyStore } from '../../stores/vocabularyStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useTemplateStore } from '../../stores/templateStore'
import { exportCSV, downloadFile } from '../../services/export'
import { wobblyMd } from '../../lib/utils'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

interface CommandItem {
  id: string
  icon: React.ReactNode
  label: string
  description?: string
  action: () => void
  category: 'action' | 'document' | 'vocabulary' | 'folder' | 'content'
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const documents = useDocumentStore((s) => s.documents)
  const createDocument = useDocumentStore((s) => s.createDocument)
  const createDocumentFromTemplate = useDocumentStore((s) => s.createDocumentFromTemplate)
  const setActiveDocument = useDocumentStore((s) => s.setActiveDocument)
  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)
  const addFolder = useFolderStore((s) => s.addFolder)
  const folders = useFolderStore((s) => s.folders)
  const activeFolderId = useFolderStore((s) => s.activeFolderId)
  const setActiveFolder = useFolderStore((s) => s.setActiveFolder)
  const entries = useVocabularyStore((s) => s.entries)
  const templates = useTemplateStore((s) => s.templates)
  const addTemplate = useTemplateStore((s) => s.addTemplate)
  const toggleSettings = useSettingsStore((s) => s.toggleSettings)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const theme = useSettingsStore((s) => s.settings.theme)
  const notify = useSettingsStore((s) => s.notify)

  const items = useMemo<CommandItem[]>(() => {
    const actions: CommandItem[] = [
      {
        id: 'new-doc',
        icon: <FilePlus size={16} strokeWidth={2.5} />,
        label: 'New Document',
        description: 'Create a new document',
        action: () => { createDocument(activeFolderId); onClose() },
        category: 'action',
      },
      {
        id: 'settings',
        icon: <Settings size={16} strokeWidth={2.5} />,
        label: 'Settings',
        description: 'Open settings panel',
        action: () => { toggleSettings(); onClose() },
        category: 'action',
      },
      {
        id: 'toggle-theme',
        icon: theme === 'dark' ? <Sun size={16} strokeWidth={2.5} /> : <Moon size={16} strokeWidth={2.5} />,
        label: theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme',
        action: () => { updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' }); onClose() },
        category: 'action',
      },
      {
        id: 'export-vocab',
        icon: <Download size={16} strokeWidth={2.5} />,
        label: 'Export Vocabulary (CSV)',
        description: `${entries.length} words`,
        action: () => { downloadFile(exportCSV(entries), 'vocabulary.csv'); notify('CSV exported!'); onClose() },
        category: 'action',
      },
    ]

    // Save current doc as template
    const activeDoc = activeDocumentId ? documents.find((d) => d.id === activeDocumentId) : null
    if (activeDoc) {
      actions.push({
        id: 'save-template',
        icon: <BookOpen size={16} strokeWidth={2.5} />,
        label: 'Save as Template',
        description: `Save "${activeDoc.title}" as a reusable template`,
        action: () => {
          addTemplate({ name: activeDoc.title, content: activeDoc.content, tags: activeDoc.tags })
          notify(`Template "${activeDoc.title}" saved!`)
          onClose()
        },
        category: 'action',
      })
    }

    // Create from template
    templates.forEach((tmpl) => {
      actions.push({
        id: `from-template-${tmpl.id}`,
        icon: <BookOpen size={16} strokeWidth={2.5} />,
        label: `New from: ${tmpl.name}`,
        description: 'Create document from template',
        action: () => {
          createDocumentFromTemplate(tmpl.content, tmpl.tags, tmpl.name, activeFolderId)
          notify(`Document created from "${tmpl.name}"`)
          onClose()
        },
        category: 'action',
      })
    })

    const docItems: CommandItem[] = documents.map((doc) => ({
      id: `doc-${doc.id}`,
      icon: <FileText size={16} strokeWidth={2.5} />,
      label: doc.title || 'Untitled',
      description: new Date(doc.updatedAt).toLocaleDateString(),
      action: () => { setActiveDocument(doc.id); onClose() },
      category: 'document' as const,
    }))

    const vocabItems: CommandItem[] = entries.map((entry) => ({
      id: `vocab-${entry.id}`,
      icon: <BookA size={16} strokeWidth={2.5} />,
      label: `${entry.word} — ${entry.translation}`,
      description: entry.contextSentence ? `"${entry.contextSentence.slice(0, 60)}..."` : undefined,
      action: () => { if (entry.documentId) setActiveDocument(entry.documentId); onClose() },
      category: 'vocabulary' as const,
    }))

    const folderItems: CommandItem[] = folders.map((folder) => ({
      id: `folder-${folder.id}`,
      icon: <Folder size={16} strokeWidth={2.5} />,
      label: folder.name,
      action: () => { setActiveFolder(folder.id); setActiveDocument(null); onClose() },
      category: 'folder' as const,
    }))

    return [...actions, ...docItems, ...vocabItems, ...folderItems]
  }, [documents, entries, folders, templates, activeDocumentId, theme, activeFolderId, createDocument, createDocumentFromTemplate, setActiveDocument, setActiveFolder, addTemplate, toggleSettings, updateSettings, notify, onClose])

  const filtered = useMemo(() => {
    if (!query.trim()) return items.filter((i) => i.category === 'action' || i.category === 'document')
    const q = query.toLowerCase()
    const results = items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q),
    )

    // Also search document content when query is 3+ chars
    if (q.length >= 3) {
      documents.forEach((doc) => {
        const text = doc.content.replace(/<[^>]*>/g, '')
        const idx = text.toLowerCase().indexOf(q)
        if (idx >= 0) {
          const start = Math.max(0, idx - 30)
          const end = Math.min(text.length, idx + q.length + 30)
          const snippet = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '')
          const existing = results.find((r) => r.id === `doc-${doc.id}`)
          if (!existing) {
            results.push({
              id: `content-${doc.id}`,
              icon: <FileText size={16} strokeWidth={2.5} />,
              label: doc.title || 'Untitled',
              description: snippet,
              action: () => { setActiveDocument(doc.id); onClose() },
              category: 'content' as const,
            })
          }
        }
      })
    }

    return results
  }, [items, query, documents, setActiveDocument, onClose])

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault()
        filtered[selectedIndex].action()
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, filtered, selectedIndex])

  // Reset selected index when filter changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-pencil/20 dark:bg-black/40" onClick={onClose} />
      <div
        className="relative bg-white dark:bg-paper-dark border-[3px] border-pencil dark:border-pencil-dark w-full max-w-lg shadow-hard-lg dark:shadow-hard-lg-dark animate-pop-in overflow-hidden"
        style={{ borderRadius: wobblyMd }}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-dashed border-pencil/20 dark:border-pencil-dark/20">
          <Search size={18} strokeWidth={2.5} className="text-pencil/40 dark:text-pencil-dark/40 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 font-body text-lg bg-transparent outline-none text-pencil dark:text-pencil-dark placeholder:text-pencil/30 dark:placeholder:text-pencil-dark/30"
          />
          <kbd className="text-xs font-mono bg-erased dark:bg-erased-dark text-pencil/40 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[300px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="text-center font-body text-pencil/40 dark:text-pencil-dark/40 py-8">
              No results found
            </p>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.id}
                onClick={item.action}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left font-body transition-colors ${
                  i === selectedIndex
                    ? 'bg-postit dark:bg-erased-dark'
                    : 'hover:bg-erased/50 dark:hover:bg-erased-dark/30'
                }`}
              >
                <span className="text-pencil/60 dark:text-pencil-dark/60 flex-shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-base text-pencil dark:text-pencil-dark">{item.label}</span>
                  {item.description && (
                    <span className="ml-2 text-sm text-pencil/40 dark:text-pencil-dark/40">{item.description}</span>
                  )}
                </div>
                <span className="text-xs text-pencil/20 dark:text-pencil-dark/20 capitalize">{item.category}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-pencil/10 dark:border-pencil-dark/10 text-xs font-body text-pencil/30 dark:text-pencil-dark/30">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  )
}
