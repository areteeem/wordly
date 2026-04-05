import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Search,
  Download,
  Table,
  LayoutGrid,
  Trash2,
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  FileText,
  FolderOpen,
  Globe,
  Pencil,
  Check,
  ClipboardCopy,
  Upload,
  Loader2,
  Navigation,
  Star,
} from 'lucide-react'
import { useVocabularyStore } from '../../stores/vocabularyStore'
import { useDocumentStore } from '../../stores/documentStore'
import { useFolderStore } from '../../stores/folderStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { Input } from '../ui/Input'
import { TagBadge } from '../ui/TagBadge'
import { exportCSV, exportTable, exportText, downloadFile } from '../../services/export'
import { translateWord } from '../../services/translation'
import { wobbly, wobblyMd, wobblySmall } from '../../lib/utils'
import type { VocabularyEntry, VocabViewMode, VocabScope } from '../../types'

export function RightSidebar() {
  const entries = useVocabularyStore((s) => s.entries)
  const addEntry = useVocabularyStore((s) => s.addEntry)
  const updateEntry = useVocabularyStore((s) => s.updateEntry)
  const deleteEntry = useVocabularyStore((s) => s.deleteEntry)
  const toggleStar = useVocabularyStore((s) => s.toggleStar)
  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)
  const documents = useDocumentStore((s) => s.documents)
  const setActiveDocument = useDocumentStore((s) => s.setActiveDocument)
  const setScrollToPosition = useDocumentStore((s) => s.setScrollToPosition)
  const folders = useFolderStore((s) => s.folders)
  const notify = useSettingsStore((s) => s.notify)
  const defaultViewMode = useSettingsStore((s) => s.settings.defaultViewMode)
  const vocabScope = useSettingsStore((s) => s.settings.vocabScope)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [viewMode, setViewMode] = useState<VocabViewMode>(defaultViewMode)
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'alpha'>('newest')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newWord, setNewWord] = useState('')
  const [newTranslation, setNewTranslation] = useState('')
  const [translationSuggestion, setTranslationSuggestion] = useState('')
  const [sugLoading, setSugLoading] = useState(false)
  const [addedFlash, setAddedFlash] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const translateTo = useSettingsStore((s) => s.settings.translateTo)
  const translateFrom = useSettingsStore((s) => s.settings.translateFrom)
  const dailyGoal = useSettingsStore((s) => s.settings.dailyGoal)
  const translationInputRef = useRef<HTMLInputElement>(null)

  const activeDoc = activeDocumentId ? documents.find((d) => d.id === activeDocumentId) : null

  // Debounced auto-translate for manual add
  useEffect(() => {
    if (!newWord.trim() || !showAddForm) {
      setTranslationSuggestion('')
      return
    }
    setSugLoading(true)
    const timer = setTimeout(() => {
      translateWord(newWord.trim(), translateFrom, translateTo).then((result) => {
        setTranslationSuggestion(result.translation)
        setSugLoading(false)
      }).catch(() => setSugLoading(false))
    }, 500)
    return () => { clearTimeout(timer); setSugLoading(false) }
  }, [newWord, translateFrom, translateTo, showAddForm])

  const filteredEntries = useMemo(() => {
    let result = entries

    // Apply scope filter
    if (vocabScope === 'file' && activeDocumentId) {
      result = result.filter((e) => e.documentId === activeDocumentId)
    } else if (vocabScope === 'folder' && activeDoc) {
      const folderDocIds = documents
        .filter((d) => d.folderId === activeDoc.folderId)
        .map((d) => d.id)
      result = result.filter((e) => folderDocIds.includes(e.documentId))
    }
    // vocabScope === 'all' -> no filter

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (e) =>
          e.word.toLowerCase().includes(q) ||
          e.translation.toLowerCase().includes(q) ||
          e.notes.toLowerCase().includes(q),
      )
    }

    if (filterTag) {
      result = result.filter((e) => e.tags.includes(filterTag))
    }

    switch (sortBy) {
      case 'newest':
        result = [...result].sort((a, b) => b.createdAt - a.createdAt)
        break
      case 'oldest':
        result = [...result].sort((a, b) => a.createdAt - b.createdAt)
        break
      case 'alpha':
        result = [...result].sort((a, b) => a.word.localeCompare(b.word))
        break
    }

    return result
  }, [entries, activeDocumentId, search, filterTag, sortBy])

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    entries.forEach((e) => e.tags.forEach((t) => tags.add(t)))
    return Array.from(tags)
  }, [entries])

  const handleExportCSV = () => {
    const csv = exportCSV(filteredEntries)
    downloadFile(csv, 'vocabulary.csv')
    notify('CSV exported!')
  }

  const handleCopyTable = () => {
    const table = exportTable(filteredEntries)
    navigator.clipboard.writeText(table)
    notify('Table copied to clipboard!')
  }

  const handleCopyList = () => {
    const text = exportText(filteredEntries, 'clean')
    navigator.clipboard.writeText(text)
    notify(`${filteredEntries.length} words copied!`)
  }

  const handleAddManualWord = () => {
    if (!newWord.trim()) return
    addEntry({
      word: newWord.trim(),
      translation: newTranslation.trim(),
      contextSentence: '',
      notes: '',
      tags: [],
      positionInDoc: 0,
      documentId: activeDocumentId || '',
    })
    notify(`"${newWord.trim()}" added!`)
    setNewWord('')
    setNewTranslation('')
    setTranslationSuggestion('')
    setAddedFlash(true)
    setTimeout(() => setAddedFlash(false), 1200)
  }

  const handleImport = () => {
    if (!importText.trim()) return
    const lines = importText.trim().split('\n').filter(Boolean)
    let count = 0
    for (const line of lines) {
      // Support formats: "word - translation", "word — translation", "word,translation", "word\ttranslation"
      const separators = [' — ', ' - ', '\t', ',']
      let word = '', translation = ''
      for (const sep of separators) {
        const idx = line.indexOf(sep)
        if (idx > 0) {
          word = line.substring(0, idx).trim()
          translation = line.substring(idx + sep.length).trim()
          break
        }
      }
      if (!word) {
        word = line.trim()
      }
      if (word) {
        addEntry({
          word,
          translation,
          contextSentence: '',
          notes: '',
          tags: ['imported'],
          positionInDoc: 0,
          documentId: activeDocumentId || '',
        })
        count++
      }
    }
    notify(`${count} word${count !== 1 ? 's' : ''} imported!`)
    setImportText('')
    setShowImport(false)
  }

  const getDocName = (docId: string) => {
    const doc = documents.find((d) => d.id === docId)
    return doc?.title || 'Untitled'
  }

  return (
    <aside className="w-full flex-shrink-0 border-l-2 border-dashed border-pencil/20 dark:border-pencil-dark/20 flex flex-col h-full bg-paper/50 dark:bg-paper-dark/50 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b-2 border-dashed border-pencil/20 dark:border-pencil-dark/20">
        <h2
          className="font-heading text-2xl text-pencil dark:text-pencil-dark mb-3"
          style={{ transform: 'rotate(1deg)' }}
        >
          📝 Vocabulary
        </h2>

        {/* Scope toggle */}
        <div className="flex gap-0.5 mb-3">
          {([
            { scope: 'file' as VocabScope, icon: FileText, label: 'File' },
            { scope: 'folder' as VocabScope, icon: FolderOpen, label: 'Folder' },
            { scope: 'all' as VocabScope, icon: Globe, label: 'All' },
          ]).map(({ scope, icon: Icon, label }) => (
            <button
              key={scope}
              onClick={() => updateSettings({ vocabScope: scope })}
              className={`flex items-center gap-1 px-2.5 py-1 font-body text-sm transition-colors ${
                vocabScope === scope
                  ? 'bg-pencil text-white dark:bg-pencil-dark dark:text-paper-dark'
                  : 'bg-white dark:bg-paper-dark text-pencil/70 dark:text-pencil-dark/70 hover:bg-erased dark:hover:bg-erased-dark'
              }`}
              style={{ borderRadius: wobbly }}
            >
              <Icon size={13} strokeWidth={2.5} />
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search
            size={16}
            strokeWidth={2.5}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-pencil/40"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search words..."
            className="pl-9 text-sm py-1.5"
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle */}
          <div
            className="flex border-2 border-pencil dark:border-pencil-dark overflow-hidden"
            style={{ borderRadius: wobbly }}
          >
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 ${viewMode === 'table' ? 'bg-pencil text-white dark:bg-pencil-dark dark:text-paper-dark' : 'bg-white dark:bg-paper-dark'}`}
              title="Table view"
            >
              <Table size={14} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 ${viewMode === 'cards' ? 'bg-pencil text-white dark:bg-pencil-dark dark:text-paper-dark' : 'bg-white dark:bg-paper-dark'}`}
              title="Cards view"
            >
              <LayoutGrid size={14} strokeWidth={2.5} />
            </button>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-2 py-1 outline-none"
            style={{ borderRadius: wobbly }}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="alpha">A-Z</option>
          </select>

          {/* Export */}
          <div className="ml-auto flex gap-1">
            <button onClick={handleExportCSV} title="Export CSV" className="p-1.5 hover:text-pen">
              <Download size={14} strokeWidth={2.5} />
            </button>
            <button onClick={handleCopyTable} title="Copy as table" className="p-1.5 hover:text-pen">
              <Copy size={14} strokeWidth={2.5} />
            </button>
            <button onClick={handleCopyList} title="Copy as word — translation list" className="p-1.5 hover:text-pen">
              <ClipboardCopy size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-2">
            {filterTag && (
              <button
                onClick={() => setFilterTag('')}
                className="text-xs font-body text-marker hover:underline"
              >
                Clear
              </button>
            )}
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
                className={`text-xs font-body px-2 py-0.5 border border-pencil dark:border-pencil-dark transition-colors ${
                  filterTag === tag
                    ? 'bg-pen text-white'
                    : 'bg-white dark:bg-paper-dark hover:bg-postit'
                }`}
                style={{ borderRadius: wobbly }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Manual add form */}
      {showAddForm && (
        <div className="p-3 border-b-2 border-dashed border-pencil/20 dark:border-pencil-dark/20 space-y-2 animate-slide-in-up">
          {addedFlash && (
            <div className="flex items-center gap-1 font-body text-sm text-green-600 animate-pop-in">
              <Check size={14} strokeWidth={3} /> Added!
            </div>
          )}
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            placeholder="Word or phrase..."
            className="w-full font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-3 py-1.5 outline-none text-pencil dark:text-pencil-dark"
            style={{ borderRadius: wobbly }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                translationInputRef.current?.focus()
              }
            }}
          />
          <div className="relative">
            <input
              ref={translationInputRef}
              type="text"
              value={newTranslation}
              onChange={(e) => setNewTranslation(e.target.value)}
              placeholder="Translation..."
              className="w-full font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-3 py-1.5 outline-none text-pen dark:text-blue-300"
              style={{ borderRadius: wobbly }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddManualWord()}
            />
            {sugLoading && (
              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-pencil/30" />
            )}
          </div>
          {/* Translation suggestion chip */}
          {translationSuggestion && !sugLoading && !newTranslation && (
            <button
              onClick={() => setNewTranslation(translationSuggestion)}
              className="flex items-center gap-1 font-body text-xs text-pen dark:text-blue-300 bg-postit/60 dark:bg-erased-dark px-2 py-1 border border-pen/20 hover:bg-postit transition-colors"
              style={{ borderRadius: wobbly }}
              title="Click to use this translation"
            >
              💡 {translationSuggestion}
            </button>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAddManualWord}
              disabled={!newWord.trim()}
              className="flex-1 flex items-center justify-center gap-1 font-body text-sm px-3 py-1.5 bg-postit border-2 border-pencil dark:border-pencil-dark hover:bg-marker hover:text-white transition-colors disabled:opacity-40"
              style={{ borderRadius: wobbly }}
            >
              <Plus size={14} strokeWidth={2.5} /> Add
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewWord(''); setNewTranslation(''); setTranslationSuggestion('') }}
              className="font-body text-sm text-pencil/40 hover:text-marker px-2"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Import form */}
      {showImport && (
        <div className="p-3 border-b-2 border-dashed border-pencil/20 dark:border-pencil-dark/20 space-y-2 animate-slide-in-up">
          <p className="font-body text-xs text-pencil/60 dark:text-pencil-dark/60">
            Paste words, one per line. Formats: <code>word — translation</code>, <code>word - translation</code>, <code>word,translation</code>
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={"apple — яблуко\ndog — собака\ncat — кіт"}
            className="w-full font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-3 py-2 outline-none text-pencil dark:text-pencil-dark resize-none"
            style={{ borderRadius: wobbly }}
            rows={5}
          />
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={!importText.trim()}
              className="flex-1 flex items-center justify-center gap-1 font-body text-sm px-3 py-1.5 bg-postit border-2 border-pencil dark:border-pencil-dark hover:bg-marker hover:text-white transition-colors disabled:opacity-40"
              style={{ borderRadius: wobbly }}
            >
              <Upload size={14} strokeWidth={2.5} /> Import
            </button>
            <button
              onClick={() => { setShowImport(false); setImportText('') }}
              className="font-body text-sm text-pencil/40 hover:text-marker px-2"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Daily goal progress */}
      {dailyGoal > 0 && (() => {
        const todayStart = new Date(); todayStart.setHours(0,0,0,0)
        const todayCount = entries.filter((e) => e.createdAt >= todayStart.getTime()).length
        const pct = Math.min(100, Math.round((todayCount / dailyGoal) * 100))
        return (
          <div className="mx-3 mb-2 p-2 bg-erased/40 dark:bg-erased-dark/40 border border-dashed border-pencil/10 dark:border-pencil-dark/10" style={{ borderRadius: wobblySmall }}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-body text-xs text-pencil/60 dark:text-pencil-dark/60">
                Daily goal
              </span>
              <span className="font-heading text-xs text-pencil dark:text-pencil-dark">
                {todayCount}/{dailyGoal} {pct >= 100 ? '🎉' : ''}
              </span>
            </div>
            <div className="w-full h-2 bg-pencil/10 dark:bg-pencil-dark/10 overflow-hidden" style={{ borderRadius: '4px' }}>
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: pct >= 100 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444',
                  borderRadius: '4px',
                }}
              />
            </div>
          </div>
        )
      })()}

      {/* Entries */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredEntries.length === 0 ? (
          <p className="text-center font-body text-pencil/40 dark:text-pencil-dark/40 mt-8 text-lg">
            {search ? 'No matches found' : 'No words yet — highlight text to add!'}
          </p>
        ) : viewMode === 'table' ? (
          <VocabTable
            entries={filteredEntries}
            onUpdate={updateEntry}
            onDelete={deleteEntry}
            onToggleStar={toggleStar}
            showDocName={vocabScope !== 'file'}
            getDocName={getDocName}
            onNavigateToDoc={(docId, position) => {
              setActiveDocument(docId)
              if (position && position > 0) {
                setTimeout(() => setScrollToPosition(position), 100)
              }
            }}
            onCopyEntry={(entry) => {
              navigator.clipboard.writeText(`${entry.word} — ${entry.translation}`)
              notify(`"${entry.word}" copied!`)
            }}
          />
        ) : (
          <VocabCards
            entries={filteredEntries}
            onUpdate={updateEntry}
            onDelete={deleteEntry}
            onToggleStar={toggleStar}
            showDocName={vocabScope !== 'file'}
            getDocName={getDocName}
            onNavigateToDoc={(docId, position) => {
              setActiveDocument(docId)
              if (position && position > 0) {
                setTimeout(() => setScrollToPosition(position), 100)
              }
            }}
            onCopyEntry={(entry) => {
              navigator.clipboard.writeText(`${entry.word} — ${entry.translation}`)
              notify(`"${entry.word}" copied!`)
            }}
          />
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t-2 border-dashed border-pencil/20 dark:border-pencil-dark/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowAddForm(!showAddForm); setShowImport(false) }}
            className="flex items-center gap-1 font-body text-sm text-pencil/60 dark:text-pencil-dark/60 hover:text-pencil dark:hover:text-pencil-dark transition-colors"
          >
            <Plus size={14} strokeWidth={2.5} />
            Add
          </button>
          <button
            onClick={() => { setShowImport(!showImport); setShowAddForm(false) }}
            className="flex items-center gap-1 font-body text-sm text-pencil/60 dark:text-pencil-dark/60 hover:text-pencil dark:hover:text-pencil-dark transition-colors"
          >
            <Upload size={14} strokeWidth={2.5} />
            Import
          </button>
        </div>
        <span className="font-body text-sm text-pencil/50 dark:text-pencil-dark/50">
          {filteredEntries.length} word{filteredEntries.length !== 1 ? 's' : ''}
        </span>
      </div>
    </aside>
  )
}

// ── Table View ──

function VocabTable({
  entries,
  onUpdate,
  onDelete,
  onToggleStar,
  showDocName,
  getDocName,
  onNavigateToDoc,
  onCopyEntry,
}: {
  entries: VocabularyEntry[]
  onUpdate: (id: string, u: Partial<VocabularyEntry>) => void
  onDelete: (id: string) => void
  onToggleStar: (id: string) => void
  showDocName?: boolean
  getDocName?: (docId: string) => string
  onNavigateToDoc?: (docId: string, position?: number) => void
  onCopyEntry?: (entry: VocabularyEntry) => void
}) {
  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-2 pb-1 border-b-2 border-pencil/20 dark:border-pencil-dark/20 font-heading text-sm text-pencil/60 dark:text-pencil-dark/60">
        <span>Word</span>
        <span>Translation</span>
        <span className="w-6" />
      </div>

      {entries.map((entry) => (
        <VocabTableRow
          key={entry.id}
          entry={entry}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onToggleStar={onToggleStar}
          showDocName={showDocName}
          getDocName={getDocName}
          onNavigateToDoc={onNavigateToDoc}
          onCopyEntry={onCopyEntry}
        />
      ))}
    </div>
  )
}

function VocabTableRow({
  entry,
  onUpdate,
  onDelete,
  onToggleStar,
  showDocName,
  getDocName,
  onNavigateToDoc,
  onCopyEntry,
}: {
  entry: VocabularyEntry
  onUpdate: (id: string, u: Partial<VocabularyEntry>) => void
  onDelete: (id: string) => void
  onToggleStar: (id: string) => void
  showDocName?: boolean
  getDocName?: (docId: string) => string
  onNavigateToDoc?: (docId: string, position?: number) => void
  onCopyEntry?: (entry: VocabularyEntry) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [editingField, setEditingField] = useState<'word' | 'translation' | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showTooltip, setShowTooltip] = useState(false)
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = () => {
    if (entry.contextSentence && !expanded) {
      tooltipTimerRef.current = setTimeout(() => setShowTooltip(true), 300)
    }
  }
  const handleMouseLeave = () => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
    setShowTooltip(false)
  }

  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !entry.tags.includes(tag)) {
      onUpdate(entry.id, { tags: [...entry.tags, tag] })
    }
    setTagInput('')
  }

  const startEdit = (field: 'word' | 'translation', e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingField(field)
    setEditValue(entry[field])
  }

  const commitEdit = () => {
    if (editingField && editValue.trim()) {
      onUpdate(entry.id, { [editingField]: editValue.trim() })
    }
    setEditingField(null)
  }

  return (
    <div className="border-b border-dashed border-pencil/10 dark:border-pencil-dark/10 animate-slide-in-right relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hover tooltip for context sentence */}
      {showTooltip && entry.contextSentence && (
        <div className="absolute z-40 left-0 right-0 -top-1 -translate-y-full bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-3 py-2 shadow-hard-sm dark:shadow-hard-sm-dark animate-pop-in pointer-events-none"
          style={{ borderRadius: wobblySmall }}
        >
          <p className="font-body text-xs text-pencil/60 dark:text-pencil-dark/60 italic leading-relaxed">
            &ldquo;{entry.contextSentence}&rdquo;
          </p>
        </div>
      )}
      <div
        className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 px-2 py-2 cursor-pointer hover:bg-erased/30 dark:hover:bg-erased-dark/30 items-center"
        onClick={() => setExpanded(!expanded)}
      >
        {editingField === 'word' ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingField(null) }}
            className="font-body text-base font-bold bg-transparent border-b-2 border-pen outline-none text-pencil dark:text-pencil-dark"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="font-body text-base font-bold text-pencil dark:text-pencil-dark truncate hover:underline decoration-dashed decoration-pencil/20"
            onDoubleClick={(e) => startEdit('word', e)}
            title="Double-click to edit"
          >
            {entry.word}
          </span>
        )}
        {editingField === 'translation' ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingField(null) }}
            className="font-body text-base bg-transparent border-b-2 border-pen outline-none text-pen dark:text-blue-300"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="font-body text-base text-pen dark:text-blue-300 truncate hover:underline decoration-dashed decoration-pen/20"
            onDoubleClick={(e) => startEdit('translation', e)}
            title="Double-click to edit"
          >
            {entry.translation}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleStar(entry.id)
          }}
          className={`p-0.5 transition-colors ${entry.starred ? 'text-yellow-500' : 'text-pencil/20 dark:text-pencil-dark/20 hover:text-yellow-400'}`}
          title={entry.starred ? 'Unstar' : 'Star'}
        >
          <Star size={14} strokeWidth={2.5} fill={entry.starred ? 'currentColor' : 'none'} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(!expanded)
          }}
          className="text-pencil/40"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && (
        <div className="px-2 pb-3 space-y-2 animate-slide-in-up">
          {/* Source document */}
          {showDocName && getDocName && (
            <button
              onClick={() => onNavigateToDoc?.(entry.documentId, entry.positionInDoc)}
              className="font-body text-xs text-pen dark:text-blue-300 flex items-center gap-1 hover:underline"
              title="Go to source document & scroll to word"
            >
              <FileText size={11} strokeWidth={2} /> {getDocName(entry.documentId)}
            </button>
          )}

          {/* Context */}
          {entry.contextSentence && (
            <p className="font-body text-sm text-pencil/60 dark:text-pencil-dark/60 italic">
              &ldquo;{entry.contextSentence}&rdquo;
            </p>
          )}

          {/* Notes inline edit */}
          <textarea
            value={entry.notes}
            onChange={(e) => onUpdate(entry.id, { notes: e.target.value })}
            placeholder="Add notes..."
            className="w-full font-body text-sm bg-transparent border-b border-dashed border-pencil/20 dark:border-pencil-dark/20 outline-none resize-none text-pencil dark:text-pencil-dark"
            rows={2}
          />

          {/* Tags */}
          <div className="flex flex-wrap gap-1 items-center">
            {entry.tags.map((tag) => (
              <TagBadge
                key={tag}
                label={tag}
                onRemove={() =>
                  onUpdate(entry.id, { tags: entry.tags.filter((t) => t !== tag) })
                }
              />
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
              placeholder="+ tag"
              className="font-body text-xs bg-transparent border-none outline-none w-16 text-pencil/40"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onCopyEntry?.(entry)}
              className="flex items-center gap-1 font-body text-xs text-pencil/50 hover:text-pencil dark:text-pencil-dark/50 dark:hover:text-pencil-dark"
              title="Copy word — translation"
            >
              <ClipboardCopy size={12} strokeWidth={2.5} />
              Copy
            </button>
            <button
              onClick={() => onDelete(entry.id)}
              className="flex items-center gap-1 font-body text-xs text-marker hover:underline"
            >
              <Trash2 size={12} strokeWidth={2.5} />
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Cards View ──

function VocabCards({
  entries,
  onUpdate,
  onDelete,
  onToggleStar,
  showDocName,
  getDocName,
  onNavigateToDoc,
  onCopyEntry,
}: {
  entries: VocabularyEntry[]
  onUpdate: (id: string, u: Partial<VocabularyEntry>) => void
  onDelete: (id: string) => void
  onToggleStar: (id: string) => void
  showDocName?: boolean
  getDocName?: (docId: string) => string
  onNavigateToDoc?: (docId: string, position?: number) => void
  onCopyEntry?: (entry: VocabularyEntry) => void
}) {
  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <VocabCard
          key={entry.id}
          entry={entry}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onToggleStar={onToggleStar}
          showDocName={showDocName}
          getDocName={getDocName}
          onNavigateToDoc={onNavigateToDoc}
          onCopyEntry={onCopyEntry}
        />
      ))}
    </div>
  )
}

function VocabCard({
  entry,
  onUpdate,
  onDelete,
  onToggleStar,
  showDocName,
  getDocName,
  onNavigateToDoc,
  onCopyEntry,
}: {
  entry: VocabularyEntry
  onUpdate: (id: string, u: Partial<VocabularyEntry>) => void
  onDelete: (id: string) => void
  onToggleStar: (id: string) => void
  showDocName?: boolean
  getDocName?: (docId: string) => string
  onNavigateToDoc?: (docId: string, position?: number) => void
  onCopyEntry?: (entry: VocabularyEntry) => void
}) {
  const [tagInput, setTagInput] = useState('')

  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !entry.tags.includes(tag)) {
      onUpdate(entry.id, { tags: [...entry.tags, tag] })
    }
    setTagInput('')
  }

  return (
    <div
      className="bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark p-4 transition-transform duration-100 hover:rotate-[0.5deg] animate-slide-in-right"
      style={{
        borderRadius: wobblyMd,
        boxShadow: '3px 3px 0px 0px rgba(45,45,45,0.1)',
      }}
    >
      <div className="flex items-start justify-between mb-1">
        <h3 className="font-heading text-xl text-pencil dark:text-pencil-dark">
          {entry.word}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggleStar(entry.id)}
            className={`transition-colors ${entry.starred ? 'text-yellow-500' : 'text-pencil/30 hover:text-yellow-400'}`}
            title={entry.starred ? 'Unstar' : 'Star'}
          >
            <Star size={14} strokeWidth={2.5} fill={entry.starred ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={() => onCopyEntry?.(entry)}
            className="text-pencil/30 hover:text-pencil transition-colors"
            title="Copy word — translation"
          >
            <ClipboardCopy size={14} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => onDelete(entry.id)}
            className="text-pencil/30 hover:text-marker transition-colors"
          >
            <Trash2 size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <p className="font-body text-lg text-pen dark:text-blue-300 mb-2">
        {entry.translation}
      </p>

      {showDocName && getDocName && (
        <button
          onClick={() => onNavigateToDoc?.(entry.documentId, entry.positionInDoc)}
          className="font-body text-xs text-pen dark:text-blue-300 flex items-center gap-1 mb-2 hover:underline"
          title="Go to source document & scroll to word"
        >
          <FileText size={11} strokeWidth={2} /> {getDocName(entry.documentId)}
        </button>
      )}

      {entry.contextSentence && (
        <p className="font-body text-sm text-pencil/50 dark:text-pencil-dark/50 italic mb-2 border-l-2 border-dashed border-pencil/20 pl-3">
          {entry.contextSentence}
        </p>
      )}

      <textarea
        value={entry.notes}
        onChange={(e) => onUpdate(entry.id, { notes: e.target.value })}
        placeholder="Notes..."
        className="w-full font-body text-sm bg-erased/30 dark:bg-erased-dark/30 border-none outline-none resize-none p-2 text-pencil dark:text-pencil-dark"
        style={{ borderRadius: wobblyMd }}
        rows={2}
      />

      <div className="flex flex-wrap gap-1 items-center mt-2">
        {entry.tags.map((tag) => (
          <TagBadge
            key={tag}
            label={tag}
            onRemove={() =>
              onUpdate(entry.id, { tags: entry.tags.filter((t) => t !== tag) })
            }
          />
        ))}
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTag()}
          placeholder="+ tag"
          className="font-body text-xs bg-transparent border-none outline-none w-16 text-pencil/40"
        />
      </div>
    </div>
  )
}
