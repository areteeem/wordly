import { useState, useMemo } from 'react'
import {
  Search,
  X,
  Star,
  StarOff,
  Download,
  Table,
  LayoutGrid,
  List,
  Layers,
  ArrowLeft,
  Volume2,
  ChevronDown,
  Trash2,
  Copy,
  Filter,
  FileText,
} from 'lucide-react'
import { useVocabularyStore } from '../../stores/vocabularyStore'
import { useDocumentStore } from '../../stores/documentStore'
import { useFolderStore } from '../../stores/folderStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { exportCSV, exportText, downloadFile } from '../../services/export'
import { wobbly, wobblyMd } from '../../lib/utils'
import { TagBadge } from '../ui/TagBadge'
import type { VocabularyEntry, VocabViewMode } from '../../types'

export function VocabFullScreen({ onClose }: { onClose: () => void }) {
  const entries = useVocabularyStore((s) => s.entries)
  const updateEntry = useVocabularyStore((s) => s.updateEntry)
  const deleteEntry = useVocabularyStore((s) => s.deleteEntry)
  const toggleStar = useVocabularyStore((s) => s.toggleStar)
  const undoDelete = useVocabularyStore((s) => s.undoDelete)
  const lastDeleted = useVocabularyStore((s) => s.lastDeleted)
  const documents = useDocumentStore((s) => s.documents)
  const setActiveDocument = useDocumentStore((s) => s.setActiveDocument)
  const setScrollToPosition = useDocumentStore((s) => s.setScrollToPosition)
  const folders = useFolderStore((s) => s.folders)
  const notify = useSettingsStore((s) => s.notify)

  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterStarred, setFilterStarred] = useState(false)
  const [filterMastery, setFilterMastery] = useState<string>('')
  const [filterDocId, setFilterDocId] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'alpha'>('newest')
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'compact'>('table')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [flashcardIndex, setFlashcardIndex] = useState(0)
  const [flashcardFlipped, setFlashcardFlipped] = useState(false)
  const [showFlashcards, setShowFlashcards] = useState(false)

  const allTags = useMemo(() => {
    const tags = new Map<string, number>()
    entries.forEach((e) => e.tags.forEach((t) => tags.set(t, (tags.get(t) || 0) + 1)))
    return Array.from(tags.entries()).sort((a, b) => b[1] - a[1])
  }, [entries])

  const filtered = useMemo(() => {
    let result = entries
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((e) =>
        e.word.toLowerCase().includes(q) ||
        e.translation.toLowerCase().includes(q) ||
        e.notes.toLowerCase().includes(q) ||
        e.contextSentence.toLowerCase().includes(q),
      )
    }
    if (filterTag) result = result.filter((e) => e.tags.includes(filterTag))
    if (filterStarred) result = result.filter((e) => e.starred)
    if (filterMastery) result = result.filter((e) => e.mastery === filterMastery)
    if (filterDocId) result = result.filter((e) => e.documentId === filterDocId)

    switch (sortBy) {
      case 'newest': result = [...result].sort((a, b) => b.createdAt - a.createdAt); break
      case 'oldest': result = [...result].sort((a, b) => a.createdAt - b.createdAt); break
      case 'alpha': result = [...result].sort((a, b) => a.word.localeCompare(b.word)); break
    }
    return result
  }, [entries, search, filterTag, filterStarred, filterMastery, filterDocId, sortBy])

  // Group by document
  const grouped = useMemo(() => {
    const map = new Map<string, VocabularyEntry[]>()
    filtered.forEach((e) => {
      const arr = map.get(e.documentId) || []
      arr.push(e)
      map.set(e.documentId, arr)
    })
    return map
  }, [filtered])

  const getDocName = (id: string) => documents.find((d) => d.id === id)?.title || 'Untitled'

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map((e) => e.id)))
  }

  const bulkDelete = () => {
    selectedIds.forEach((id) => deleteEntry(id))
    notify(`${selectedIds.size} words deleted`)
    setSelectedIds(new Set())
  }

  const bulkExport = () => {
    const selected = entries.filter((e) => selectedIds.has(e.id))
    const csv = exportCSV(selected)
    downloadFile(csv, 'vocabulary-selected.csv')
    notify('Selected words exported!')
  }

  const speakWord = (word: string) => {
    const utterance = new SpeechSynthesisUtterance(word)
    speechSynthesis.speak(utterance)
  }

  const handleNavigate = (entry: VocabularyEntry) => {
    setActiveDocument(entry.documentId)
    if (entry.positionInDoc > 0) {
      setTimeout(() => setScrollToPosition(entry.positionInDoc), 100)
    }
    onClose()
  }

  // Flashcard mode
  if (showFlashcards && filtered.length > 0) {
    const card = filtered[flashcardIndex % filtered.length]
    return (
      <div className="fixed inset-0 z-50 bg-paper dark:bg-paper-dark flex flex-col items-center justify-center p-8">
        <div className="absolute top-4 right-4 flex items-center gap-3">
          <span className="font-body text-sm text-pencil/50">{flashcardIndex + 1} / {filtered.length}</span>
          <button onClick={() => setShowFlashcards(false)} className="text-pencil/60 hover:text-marker">
            <X size={24} strokeWidth={2.5} />
          </button>
        </div>

        <div
          className="w-full max-w-md aspect-[3/2] bg-white dark:bg-paper-dark border-[3px] border-pencil dark:border-pencil-dark flex items-center justify-center cursor-pointer transition-transform duration-300 hover:rotate-1"
          style={{ borderRadius: wobblyMd, boxShadow: '6px 6px 0px 0px rgba(45,45,45,0.15)' }}
          onClick={() => setFlashcardFlipped(!flashcardFlipped)}
        >
          <div className="text-center p-8">
            <p className="font-heading text-4xl text-pencil dark:text-pencil-dark mb-2">
              {flashcardFlipped ? card.translation : card.word}
            </p>
            {flashcardFlipped && card.contextSentence && (
              <p className="font-body text-sm text-pencil/50 dark:text-pencil-dark/50 italic mt-4">
                &ldquo;{card.contextSentence}&rdquo;
              </p>
            )}
            <p className="font-body text-xs text-pencil/30 mt-4">
              {flashcardFlipped ? 'Click to see word' : 'Click to reveal translation'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-8">
          <button
            onClick={() => { setFlashcardIndex(Math.max(0, flashcardIndex - 1)); setFlashcardFlipped(false) }}
            className="px-6 py-2 font-body text-lg border-2 border-pencil dark:border-pencil-dark bg-white dark:bg-paper-dark hover:bg-erased dark:hover:bg-erased-dark transition-colors"
            style={{ borderRadius: wobbly }}
            disabled={flashcardIndex === 0}
          >
            ← Previous
          </button>
          <button
            onClick={() => speakWord(card.word)}
            className="p-2 text-pencil/60 hover:text-pen"
            title="Pronounce"
          >
            <Volume2 size={20} />
          </button>
          <button
            onClick={() => { setFlashcardIndex(Math.min(filtered.length - 1, flashcardIndex + 1)); setFlashcardFlipped(false) }}
            className="px-6 py-2 font-body text-lg border-2 border-pencil dark:border-pencil-dark bg-postit hover:bg-marker hover:text-white transition-colors"
            style={{ borderRadius: wobbly }}
            disabled={flashcardIndex >= filtered.length - 1}
          >
            Next →
          </button>
        </div>

        {/* Mastery buttons */}
        <div className="flex items-center gap-3 mt-6">
          {(['learning', 'familiar', 'mastered'] as const).map((level) => (
            <button
              key={level}
              onClick={() => updateEntry(card.id, { mastery: level })}
              className={`px-4 py-1.5 font-body text-sm border-2 border-pencil dark:border-pencil-dark transition-colors ${
                card.mastery === level
                  ? level === 'mastered' ? 'bg-green-400 text-white' : level === 'familiar' ? 'bg-yellow-400' : 'bg-orange-400 text-white'
                  : 'bg-white dark:bg-paper-dark hover:bg-erased'
              }`}
              style={{ borderRadius: wobbly }}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-paper dark:bg-paper-dark flex flex-col overflow-hidden animate-pop-in">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b-2 border-dashed border-pencil/20 dark:border-pencil-dark/20">
        <button onClick={onClose} className="flex items-center gap-1 font-body text-sm text-pencil/60 hover:text-pencil transition-colors">
          <ArrowLeft size={18} strokeWidth={2.5} /> Back
        </button>
        <div className="flex items-center gap-2" style={{ transform: 'rotate(-1deg)' }}>
          <FileText size={24} strokeWidth={2.5} className="text-pencil dark:text-pencil-dark" />
          <h1 className="font-heading text-3xl text-pencil dark:text-pencil-dark">All Vocabulary</h1>
        </div>
        <span className="font-body text-sm text-pencil/50 ml-auto">{filtered.length} words</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 p-4 flex-wrap border-b border-pencil/10 dark:border-pencil-dark/10">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-pencil/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all words..."
            className="w-full font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark pl-9 pr-3 py-2 outline-none"
            style={{ borderRadius: wobbly }}
          />
        </div>

        {/* View modes */}
        <div className="flex border-2 border-pencil dark:border-pencil-dark overflow-hidden" style={{ borderRadius: wobbly }}>
          {([
            { mode: 'table' as const, icon: Table, label: 'Table' },
            { mode: 'cards' as const, icon: LayoutGrid, label: 'Cards' },
            { mode: 'compact' as const, icon: List, label: 'Compact' },
          ]).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`p-2 ${viewMode === mode ? 'bg-pencil text-white dark:bg-pencil-dark dark:text-paper-dark' : 'bg-white dark:bg-paper-dark'}`}
              title={label}
            >
              <Icon size={16} strokeWidth={2.5} />
            </button>
          ))}
        </div>

        {/* Flashcards */}
        <button
          onClick={() => { setShowFlashcards(true); setFlashcardIndex(0); setFlashcardFlipped(false) }}
          className="flex items-center gap-1 px-3 py-2 font-body text-sm border-2 border-pencil dark:border-pencil-dark bg-postit hover:bg-marker hover:text-white transition-colors"
          style={{ borderRadius: wobbly }}
        >
          <Layers size={14} strokeWidth={2.5} /> Flashcards
        </button>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-3 py-2 outline-none"
          style={{ borderRadius: wobbly }}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="alpha">A-Z</option>
        </select>

        {/* Filter starred */}
        <button
          onClick={() => setFilterStarred(!filterStarred)}
          className={`p-2 border-2 border-pencil dark:border-pencil-dark transition-colors ${filterStarred ? 'bg-yellow-300' : 'bg-white dark:bg-paper-dark'}`}
          style={{ borderRadius: wobbly }}
          title="Show starred only"
        >
          <Star size={16} strokeWidth={2.5} className={filterStarred ? 'text-yellow-700' : 'text-pencil/40'} />
        </button>

        {/* Filter mastery */}
        <select
          value={filterMastery}
          onChange={(e) => setFilterMastery(e.target.value)}
          className="font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-3 py-2 outline-none"
          style={{ borderRadius: wobbly }}
        >
          <option value="">All levels</option>
          <option value="learning">Learning</option>
          <option value="familiar">Familiar</option>
          <option value="mastered">Mastered</option>
        </select>

        {/* Filter by document */}
        <select
          value={filterDocId}
          onChange={(e) => setFilterDocId(e.target.value)}
          className="font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-3 py-2 outline-none max-w-[160px]"
          style={{ borderRadius: wobbly }}
        >
          <option value="">All documents</option>
          {documents.map((d) => (
            <option key={d.id} value={d.id}>{d.title || 'Untitled'}</option>
          ))}
        </select>

        {/* Export */}
        <button
          onClick={() => {
            const csv = exportCSV(filtered)
            downloadFile(csv, 'vocabulary.csv')
            notify('Exported!')
          }}
          className="p-2 text-pencil/60 hover:text-pen"
          title="Export filtered as CSV"
        >
          <Download size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* Tags bar */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-pencil/10 dark:border-pencil-dark/10 overflow-x-auto">
          <Filter size={14} className="text-pencil/40 flex-shrink-0" />
          {filterTag && (
            <button onClick={() => setFilterTag('')} className="text-xs font-body text-marker hover:underline flex-shrink-0">
              Clear
            </button>
          )}
          {allTags.slice(0, 20).map(([tag, count]) => (
            <button
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
              className={`flex-shrink-0 text-xs font-body px-2 py-0.5 border border-pencil dark:border-pencil-dark transition-colors ${
                filterTag === tag ? 'bg-pen text-white' : 'bg-white dark:bg-paper-dark hover:bg-postit'
              }`}
              style={{ borderRadius: wobbly }}
            >
              {tag} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-postit/50 dark:bg-erased-dark border-b border-pencil/10">
          <span className="font-body text-sm text-pencil dark:text-pencil-dark">{selectedIds.size} selected</span>
          <button onClick={bulkDelete} className="flex items-center gap-1 font-body text-xs text-marker hover:underline">
            <Trash2 size={12} /> Delete
          </button>
          <button onClick={bulkExport} className="flex items-center gap-1 font-body text-xs text-pen hover:underline">
            <Download size={12} /> Export
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="font-body text-xs text-pencil/40 hover:text-pencil ml-auto">
            Clear selection
          </button>
        </div>
      )}

      {/* Undo bar */}
      {lastDeleted && (
        <div className="flex items-center gap-3 px-4 py-2 bg-marker/10 border-b border-marker/20">
          <span className="font-body text-sm text-pencil dark:text-pencil-dark">
            Deleted &ldquo;{lastDeleted.word}&rdquo;
          </span>
          <button onClick={undoDelete} className="font-body text-sm text-pen hover:underline font-bold">
            Undo
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <p className="text-center font-body text-xl text-pencil/40 mt-16">No words match your filters</p>
        ) : viewMode === 'compact' ? (
          /* Compact list */
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <input type="checkbox" checked={selectedIds.size === filtered.length} onChange={selectAll} className="w-4 h-4" />
              <span className="font-body text-xs text-pencil/40">Select all</span>
            </div>
            {filtered.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-3 py-1.5 border-b border-dashed border-pencil/10 dark:border-pencil-dark/10 hover:bg-erased/30 dark:hover:bg-erased-dark/30 group"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(entry.id)}
                  onChange={() => toggleSelect(entry.id)}
                  className="w-4 h-4 flex-shrink-0"
                />
                <button onClick={() => toggleStar(entry.id)} className="flex-shrink-0">
                  {entry.starred ? <Star size={14} className="text-yellow-500 fill-yellow-500" /> : <StarOff size={14} className="text-pencil/20" />}
                </button>
                <span className="font-body text-base font-bold text-pencil dark:text-pencil-dark min-w-[120px]">{entry.word}</span>
                <span className="font-body text-base text-pen dark:text-blue-300 flex-1">{entry.translation}</span>
                <span className={`font-body text-xs px-2 py-0.5 border ${
                  entry.mastery === 'mastered' ? 'bg-green-100 text-green-700 border-green-300' :
                  entry.mastery === 'familiar' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                  'bg-orange-100 text-orange-700 border-orange-300'
                }`} style={{ borderRadius: wobbly }}>
                  {entry.mastery}
                </span>
                <button
                  onClick={() => speakWord(entry.word)}
                  className="text-pencil/30 hover:text-pen opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Pronounce"
                >
                  <Volume2 size={14} />
                </button>
                <button
                  onClick={() => handleNavigate(entry)}
                  className="text-pencil/30 hover:text-pen opacity-0 group-hover:opacity-100 transition-opacity text-xs font-body"
                >
                  Go to doc →
                </button>
              </div>
            ))}
          </div>
        ) : viewMode === 'cards' ? (
          /* Cards grouped by document */
          <div className="max-w-4xl mx-auto space-y-6">
            {Array.from(grouped.entries()).map(([docId, docEntries]) => (
              <div key={docId}>
                <h3 className="font-heading text-lg text-pencil dark:text-pencil-dark mb-2 flex items-center gap-2">
                  <FileText size={16} strokeWidth={2.5} />
                  {getDocName(docId)}
                  <span className="font-body text-xs text-pencil/40">({docEntries.length})</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {docEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark p-4 transition-transform duration-100 hover:rotate-[0.5deg]"
                      style={{ borderRadius: wobblyMd, boxShadow: '3px 3px 0px 0px rgba(45,45,45,0.1)' }}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-heading text-xl text-pencil dark:text-pencil-dark">{entry.word}</h4>
                        <button onClick={() => toggleStar(entry.id)}>
                          {entry.starred ? <Star size={16} className="text-yellow-500 fill-yellow-500" /> : <StarOff size={16} className="text-pencil/20" />}
                        </button>
                      </div>
                      <p className="font-body text-lg text-pen dark:text-blue-300 mb-2">{entry.translation}</p>
                      {entry.contextSentence && (
                        <p className="font-body text-xs text-pencil/50 italic mb-2 border-l-2 border-dashed border-pencil/20 pl-2">
                          &ldquo;{entry.contextSentence}&rdquo;
                        </p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        {entry.tags.map((tag) => (
                          <span key={tag} className="text-xs font-body px-1.5 py-0.5 bg-postit border border-pencil/20" style={{ borderRadius: wobbly }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table view */
          <div className="max-w-5xl mx-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-pencil/20 dark:border-pencil-dark/20">
                  <th className="w-8 py-2">
                    <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={selectAll} className="w-4 h-4" />
                  </th>
                  <th className="text-left font-heading text-sm text-pencil/60 py-2">★</th>
                  <th className="text-left font-heading text-sm text-pencil/60 py-2">Word</th>
                  <th className="text-left font-heading text-sm text-pencil/60 py-2">Translation</th>
                  <th className="text-left font-heading text-sm text-pencil/60 py-2">Context</th>
                  <th className="text-left font-heading text-sm text-pencil/60 py-2">Tags</th>
                  <th className="text-left font-heading text-sm text-pencil/60 py-2">Level</th>
                  <th className="text-left font-heading text-sm text-pencil/60 py-2">Document</th>
                  <th className="w-20 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.id} className="border-b border-dashed border-pencil/10 hover:bg-erased/30 dark:hover:bg-erased-dark/30 group">
                    <td className="py-2">
                      <input type="checkbox" checked={selectedIds.has(entry.id)} onChange={() => toggleSelect(entry.id)} className="w-4 h-4" />
                    </td>
                    <td className="py-2">
                      <button onClick={() => toggleStar(entry.id)}>
                        {entry.starred ? <Star size={14} className="text-yellow-500 fill-yellow-500" /> : <StarOff size={14} className="text-pencil/20" />}
                      </button>
                    </td>
                    <td className="py-2 font-body font-bold text-pencil dark:text-pencil-dark">{entry.word}</td>
                    <td className="py-2 font-body text-pen dark:text-blue-300">{entry.translation}</td>
                    <td className="py-2 font-body text-xs text-pencil/50 max-w-[200px] truncate">{entry.contextSentence}</td>
                    <td className="py-2">
                      <div className="flex gap-1 flex-wrap">
                        {entry.tags.slice(0, 2).map((t) => (
                          <span key={t} className="text-xs font-body px-1 bg-postit border border-pencil/20" style={{ borderRadius: '4px' }}>{t}</span>
                        ))}
                        {entry.tags.length > 2 && <span className="text-xs text-pencil/30">+{entry.tags.length - 2}</span>}
                      </div>
                    </td>
                    <td className="py-2">
                      <select
                        value={entry.mastery}
                        onChange={(e) => updateEntry(entry.id, { mastery: e.target.value as VocabularyEntry['mastery'] })}
                        className="font-body text-xs bg-transparent border border-pencil/20 px-1 py-0.5 outline-none"
                        style={{ borderRadius: '4px' }}
                      >
                        <option value="learning">Learning</option>
                        <option value="familiar">Familiar</option>
                        <option value="mastered">Mastered</option>
                      </select>
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => handleNavigate(entry)}
                        className="font-body text-xs text-pen hover:underline max-w-[120px] truncate block"
                      >
                        {getDocName(entry.documentId)}
                      </button>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => speakWord(entry.word)} className="p-1 text-pencil/30 hover:text-pen" title="Pronounce">
                          <Volume2 size={12} />
                        </button>
                        <button
                          onClick={() => { navigator.clipboard.writeText(`${entry.word} — ${entry.translation}`); notify('Copied!') }}
                          className="p-1 text-pencil/30 hover:text-pen"
                          title="Copy"
                        >
                          <Copy size={12} />
                        </button>
                        <button onClick={() => deleteEntry(entry.id)} className="p-1 text-pencil/30 hover:text-marker" title="Delete">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
