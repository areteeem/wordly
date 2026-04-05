import { useEffect, useCallback, useRef, useState } from 'react'
import { Settings, PanelLeftClose, PanelLeft, PanelRightClose, PanelRight, Search, BookOpen, Target, Download } from 'lucide-react'
import { Editor } from './components/Editor/Editor'
import { LeftSidebar } from './components/Sidebar/LeftSidebar'
import { RightSidebar } from './components/Vocabulary/RightSidebar'
import { SettingsPanel } from './components/Settings/SettingsPanel'
import { CommandPalette } from './components/ui/CommandPalette'
import { KeyboardShortcuts } from './components/ui/KeyboardShortcuts'
import { Notifications } from './components/ui/Notifications'
import { VocabFullScreen } from './components/Vocabulary/VocabFullScreen'
import { ExerciseMode } from './components/Exercises/ExerciseMode'
import { ExportDialog } from './components/Export/ExportDialog'
import { useFolderStore } from './stores/folderStore'
import { useDocumentStore } from './stores/documentStore'
import { useVocabularyStore } from './stores/vocabularyStore'
import { useSettingsStore } from './stores/settingsStore'
import { useTemplateStore } from './stores/templateStore'

function App() {
  const loadFolders = useFolderStore((s) => s.load)
  const loadDocuments = useDocumentStore((s) => s.load)
  const loadVocabulary = useVocabularyStore((s) => s.load)
  const loadSettings = useSettingsStore((s) => s.load)
  const loadTemplates = useTemplateStore((s) => s.load)
  const theme = useSettingsStore((s) => s.settings.theme)
  const toggleSettings = useSettingsStore((s) => s.toggleSettings)
  const settingsOpen = useSettingsStore((s) => s.settingsOpen)
  const leftPanelWidth = useSettingsStore((s) => s.settings.leftPanelWidth)
  const rightPanelWidth = useSettingsStore((s) => s.settings.rightPanelWidth)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const createDocument = useDocumentStore((s) => s.createDocument)
  const activeFolderId = useFolderStore((s) => s.activeFolderId)

  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [vocabFullScreenOpen, setVocabFullScreenOpen] = useState(false)
  const [exerciseOpen, setExerciseOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // Resize state
  const [resizing, setResizing] = useState<'left' | 'right' | null>(null)
  const resizeRef = useRef<{ startX: number; startWidth: number }>({ startX: 0, startWidth: 0 })

  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // On mobile, close sidebars by default
  useEffect(() => {
    if (isMobile) {
      setLeftOpen(false)
      setRightOpen(false)
    }
  }, [isMobile])

  // Load all data on mount
  useEffect(() => {
    loadFolders()
    loadDocuments()
    loadVocabulary()
    loadSettings()
    loadTemplates()
  }, [])

  // Apply theme class to <html>
  useEffect(() => {
    const html = document.documentElement
    html.classList.remove('dark', 'neutral')
    if (theme === 'dark') html.classList.add('dark')
    if (theme === 'neutral') html.classList.add('neutral')
  }, [theme])

  // Resize handlers
  const handleResizeStart = useCallback((side: 'left' | 'right', e: React.MouseEvent) => {
    e.preventDefault()
    setResizing(side)
    resizeRef.current = {
      startX: e.clientX,
      startWidth: side === 'left' ? leftPanelWidth : rightPanelWidth,
    }
  }, [leftPanelWidth, rightPanelWidth])

  useEffect(() => {
    if (!resizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeRef.current.startX
      const newWidth = resizing === 'left'
        ? Math.max(180, Math.min(450, resizeRef.current.startWidth + delta))
        : Math.max(220, Math.min(500, resizeRef.current.startWidth - delta))

      if (resizing === 'left') {
        updateSettings({ leftPanelWidth: newWidth })
      } else {
        updateSettings({ rightPanelWidth: newWidth })
      }
    }

    const handleMouseUp = () => setResizing(null)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizing, updateSettings])

  // Global hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd+K = Command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen((prev) => !prev)
        return
      }
      // Ctrl/Cmd+N = New document
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        createDocument(activeFolderId)
        return
      }
      // Ctrl/Cmd+, = Settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault()
        toggleSettings()
        return
      }
      // Ctrl+Shift+F = Toggle folders sidebar
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        setLeftOpen((prev) => !prev)
        return
      }
      // Ctrl+Shift+V = Toggle vocabulary sidebar
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
        e.preventDefault()
        setRightOpen((prev) => !prev)
        return
      }
      // Ctrl+Shift+B = Vocab full screen
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'B') {
        e.preventDefault()
        setVocabFullScreenOpen((prev) => !prev)
        return
      }
      // Ctrl+Shift+X = Exercises
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'X') {
        e.preventDefault()
        setExerciseOpen((prev) => !prev)
        return
      }
      // Ctrl+Shift+E = Export dialog
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault()
        setExportDialogOpen((prev) => !prev)
        return
      }
      // Escape = close modals
      if (e.key === 'Escape') {
        if (vocabFullScreenOpen) { setVocabFullScreenOpen(false); return }
        if (exerciseOpen) { setExerciseOpen(false); return }
        if (exportDialogOpen) { setExportDialogOpen(false); return }
        if (shortcutsOpen) { setShortcutsOpen(false); return }
        if (commandPaletteOpen) { setCommandPaletteOpen(false); return }
        if (settingsOpen) { toggleSettings(); return }
      }
      // ? = Keyboard shortcuts (only when not typing in input/editor)
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !(e.target as HTMLElement)?.closest('.ProseMirror')) {
          e.preventDefault()
          setShortcutsOpen((prev) => !prev)
          return
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [commandPaletteOpen, settingsOpen, activeFolderId, createDocument, toggleSettings, vocabFullScreenOpen, exerciseOpen, exportDialogOpen, shortcutsOpen])

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b-2 border-dashed border-pencil/20 dark:border-pencil-dark/20 bg-paper dark:bg-paper-dark">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLeftOpen(!leftOpen)}
            className="p-1.5 text-pencil/60 dark:text-pencil-dark/60 hover:text-pencil dark:hover:text-pencil-dark transition-colors"
            title={leftOpen ? 'Hide folders (Ctrl+Shift+F)' : 'Show folders (Ctrl+Shift+F)'}
          >
            {leftOpen ? (
              <PanelLeftClose size={20} strokeWidth={2.5} />
            ) : (
              <PanelLeft size={20} strokeWidth={2.5} />
            )}
          </button>

          <h1
            className="font-heading text-2xl md:text-3xl text-pencil dark:text-pencil-dark select-none"
            style={{ transform: 'rotate(-2deg)' }}
          >
            Wordly
            <span
              className="inline-block text-marker ml-1 animate-bounce"
              style={{ animationDuration: '3s' }}
            >
              !
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 text-pencil/40 dark:text-pencil-dark/40 hover:text-pencil dark:hover:text-pencil-dark border border-pencil/20 dark:border-pencil-dark/20 font-body text-sm transition-colors"
            style={{ borderRadius: '8px' }}
            title="Command palette (Ctrl+K)"
          >
            <Search size={14} strokeWidth={2.5} />
            <span className="hidden md:inline">Search...</span>
            <kbd className="hidden md:inline text-xs bg-erased dark:bg-erased-dark px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
          </button>

          <button
            onClick={() => setVocabFullScreenOpen(true)}
            className="p-2 text-pencil/60 dark:text-pencil-dark/60 hover:text-pencil dark:hover:text-pencil-dark transition-colors"
            title="Vocabulary browser (Ctrl+Shift+B)"
          >
            <BookOpen size={18} strokeWidth={2.5} />
          </button>

          <button
            onClick={() => setExerciseOpen(true)}
            className="p-2 text-pencil/60 dark:text-pencil-dark/60 hover:text-pencil dark:hover:text-pencil-dark transition-colors"
            title="Exercises (Ctrl+Shift+X)"
          >
            <Target size={18} strokeWidth={2.5} />
          </button>

          <button
            onClick={() => setExportDialogOpen(true)}
            className="p-2 text-pencil/60 dark:text-pencil-dark/60 hover:text-pencil dark:hover:text-pencil-dark transition-colors"
            title="Export vocabulary (Ctrl+Shift+E)"
          >
            <Download size={18} strokeWidth={2.5} />
          </button>

          <button
            onClick={toggleSettings}
            className="p-2 text-pencil/60 dark:text-pencil-dark/60 hover:text-pencil dark:hover:text-pencil-dark hover:rotate-[15deg] transition-all duration-200"
            title="Settings (Ctrl+,)"
          >
            <Settings size={20} strokeWidth={2.5} />
          </button>

          <button
            onClick={() => setRightOpen(!rightOpen)}
            className="p-1.5 text-pencil/60 dark:text-pencil-dark/60 hover:text-pencil dark:hover:text-pencil-dark transition-colors"
            title={rightOpen ? 'Hide vocabulary (Ctrl+Shift+V)' : 'Show vocabulary (Ctrl+Shift+V)'}
          >
            {rightOpen ? (
              <PanelRightClose size={20} strokeWidth={2.5} />
            ) : (
              <PanelRight size={20} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {leftOpen && !isMobile && (
          <>
            <div style={{ width: leftPanelWidth, flexShrink: 0 }} className="panel-slide-left">
              <LeftSidebar />
            </div>
            <div
              className="resize-handle"
              onMouseDown={(e) => handleResizeStart('left', e)}
            />
          </>
        )}
        <Editor />
        {rightOpen && !isMobile && (
          <>
            <div
              className="resize-handle"
              onMouseDown={(e) => handleResizeStart('right', e)}
            />
            <div style={{ width: rightPanelWidth, flexShrink: 0 }} className="panel-slide-right">
              <RightSidebar />
            </div>
          </>
        )}
      </div>

      {/* Mobile sidebar overlays */}
      {isMobile && leftOpen && (
        <>
          <div className="mobile-sidebar-overlay" onClick={() => setLeftOpen(false)} />
          <div className="mobile-sidebar-panel left bg-paper dark:bg-paper-dark border-r-2 border-pencil/20 dark:border-pencil-dark/20">
            <LeftSidebar />
          </div>
        </>
      )}
      {isMobile && rightOpen && (
        <>
          <div className="mobile-sidebar-overlay" onClick={() => setRightOpen(false)} />
          <div className="mobile-sidebar-panel right bg-paper dark:bg-paper-dark border-l-2 border-pencil/20 dark:border-pencil-dark/20">
            <RightSidebar />
          </div>
        </>
      )}

      {/* Overlays */}
      <SettingsPanel />
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      {vocabFullScreenOpen && <VocabFullScreen onClose={() => setVocabFullScreenOpen(false)} />}
      {exerciseOpen && <ExerciseMode onClose={() => setExerciseOpen(false)} />}
      <ExportDialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} />
      <KeyboardShortcuts open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <Notifications />
    </div>
  )
}

export default App
