import { useState, useMemo, useCallback } from 'react'
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
  Calendar,
  BarChart3,
} from 'lucide-react'
import { useVocabularyStore } from '../../stores/vocabularyStore'
import { useDocumentStore } from '../../stores/documentStore'
import { useFolderStore } from '../../stores/folderStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { exportCSV, exportText, downloadFile } from '../../services/export'
import { buildFlashcardPrompts } from '../../lib/vocabulary'
import { wobbly, wobblyMd } from '../../lib/utils'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { TagBadge } from '../ui/TagBadge'
import type { VocabularyEntry, VocabViewMode } from '../../types'

export function VocabFullScreen({ onClose }: { onClose: () => void }) {
  const entries = useVocabularyStore((s) => s.entries)
  const updateEntry = useVocabularyStore((s) => s.updateEntry)
  const deleteEntry = useVocabularyStore((s) => s.deleteEntry)
  const toggleStar = useVocabularyStore((s) => s.toggleStar)
  const undoDelete = useVocabularyStore((s) => s.undoDelete)
  const lastDeleted = useVocabularyStore((s) => s.lastDeleted)
  const reviewEntry = useVocabularyStore((s) => s.reviewEntry)
  const getRecommendations = useVocabularyStore((s) => s.getRecommendations)
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
  const [groupBy, setGroupBy] = useState<'none' | 'date' | 'mastery' | 'letter'>('none')
  const [flashcardSwipeX, setFlashcardSwipeX] = useState(0)
  const [flashcardSwipeStart, setFlashcardSwipeStart] = useState<number | null>(null)

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
    if (filterDocId) {
      result = result.filter((e) => e.occurrences.some((occurrence) => occurrence.documentId === filterDocId))
    }

    switch (sortBy) {
      case 'newest': result = [...result].sort((a, b) => b.createdAt - a.createdAt); break
      case 'oldest': result = [...result].sort((a, b) => a.createdAt - b.createdAt); break
      case 'alpha': result = [...result].sort((a, b) => a.word.localeCompare(b.word)); break
    }
    return result
  }, [entries, search, filterTag, filterStarred, filterMastery, filterDocId, sortBy])

  const flashcards = useMemo(() => {
    const dueOnly = filtered.some((entry) => entry.srs.dueAt <= Date.now() || entry.srs.reviewCount === 0)
    return buildFlashcardPrompts(filtered, {
      documentId: filterDocId || undefined,
      limit: 48,
      dueOnly,
    })
  }, [filtered, filterDocId])

  const recommendations = useMemo(
    () => getRecommendations(filterDocId || undefined, 6),
    [filterDocId, getRecommendations],
  )

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

  // Grouped sections (Feature #13)
  const groupedSections = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: 'All Words', items: filtered }]

    const sections: { key: string; label: string; items: VocabularyEntry[] }[] = []
    const map = new Map<string, VocabularyEntry[]>()

    filtered.forEach((e) => {
      let key: string
      if (groupBy === 'date') {
        const d = new Date(e.createdAt)
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const week = new Date(today.getTime() - 7 * 86400000)
        const month = new Date(today.getTime() - 30 * 86400000)
        key = d >= today ? 'Today' : d >= week ? 'This Week' : d >= month ? 'This Month' : 'Older'
      } else if (groupBy === 'mastery') {
        key = e.mastery.charAt(0).toUpperCase() + e.mastery.slice(1)
      } else {
        key = e.word.charAt(0).toUpperCase()
      }
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    })

    const order = groupBy === 'date'
      ? ['Today', 'This Week', 'This Month', 'Older']
      : groupBy === 'mastery'
      ? ['Learning', 'Familiar', 'Mastered']
      : Array.from(map.keys()).sort()

    order.forEach((k) => {
      if (map.has(k)) sections.push({ key: k, label: k, items: map.get(k)! })
    })
    // Catch any leftovers
    map.forEach((items, key) => {
      if (!sections.find(s => s.key === key)) sections.push({ key, label: key, items })
    })

    return sections
  }, [filtered, groupBy])

  // Search highlighting helper (Feature #14)
  const highlightMatch = useCallback((text: string) => {
    if (!search.trim()) return <>{text}</>
    const q = search.trim()
    const idx = text.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return <>{text}</>
    return (
      <>
        {text.slice(0, idx)}
        <span className="search-highlight">{text.slice(idx, idx + q.length)}</span>
        {text.slice(idx + q.length)}
      </>
    )
  }, [search])

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
    const targetOccurrence = filterDocId
      ? entry.occurrences.find((occurrence) => occurrence.documentId === filterDocId)
      : entry.occurrences[0]
    const targetDocumentId = targetOccurrence?.documentId || entry.documentId
    const targetPosition = targetOccurrence?.positionInDoc || entry.positionInDoc

    setActiveDocument(targetDocumentId)
    if (targetPosition > 0) {
      setTimeout(() => setScrollToPosition(targetPosition), 100)
    }
    onClose()
  }

  // Flashcard mode (Feature #9 — now powered by the shared SRS scheduler)
  if (showFlashcards && flashcards.length > 0) {
    const card = flashcards[flashcardIndex % flashcards.length]
    const progress = ((flashcardIndex + 1) / flashcards.length) * 100

    const handleFlashcardTouchStart = (e: React.TouchEvent) => {
      setFlashcardSwipeStart(e.touches[0].clientX)
      setFlashcardSwipeX(0)
    }
    const handleFlashcardTouchMove = (e: React.TouchEvent) => {
      if (flashcardSwipeStart !== null) {
        setFlashcardSwipeX(e.touches[0].clientX - flashcardSwipeStart)
      }
    }
    const handleFlashcardTouchEnd = () => {
      if (Math.abs(flashcardSwipeX) > 80) {
        if (flashcardSwipeX < 0 && flashcardIndex < flashcards.length - 1) {
          setFlashcardIndex(flashcardIndex + 1)
          setFlashcardFlipped(false)
        } else if (flashcardSwipeX > 0 && flashcardIndex > 0) {
          setFlashcardIndex(flashcardIndex - 1)
          setFlashcardFlipped(false)
        }
      }
      setFlashcardSwipeX(0)
      setFlashcardSwipeStart(null)
    }

    const submitReview = (grade: 'again' | 'hard' | 'good' | 'easy') => {
      reviewEntry(card.entryId, grade, card.type)
      setFlashcardFlipped(false)
      setFlashcardIndex((current) => Math.min(current + 1, Math.max(0, flashcards.length - 1)))
      notify(`Reviewed ${card.answer}`)
    }

    return (
      <div className="fixed inset-0 z-50 bg-paper dark:bg-paper-dark flex flex-col items-center justify-center p-4 md:p-8">
        <div className="absolute top-4 right-4 flex items-center gap-3">
          <span className="font-body text-sm text-pencil/50">{flashcardIndex + 1} / {flashcards.length}</span>
          <button onClick={() => setShowFlashcards(false)} className="text-pencil/60 hover:text-marker" aria-label="Close flashcards">
            <X size={24} strokeWidth={2.5} />
          </button>
        </div>

        {/* Progress bar at top */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-erased dark:bg-erased-dark">
          <div className="h-full bg-pen transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {/* 3D Flashcard */}
        <div
          className="flashcard-3d w-full max-w-md aspect-[3/2] cursor-pointer select-none"
          onClick={() => setFlashcardFlipped(!flashcardFlipped)}
          onTouchStart={handleFlashcardTouchStart}
          onTouchMove={handleFlashcardTouchMove}
          onTouchEnd={handleFlashcardTouchEnd}
          style={{
            transform: `translateX(${flashcardSwipeX * 0.3}px) rotate(${flashcardSwipeX * 0.02}deg)`,
            transition: flashcardSwipeStart !== null ? 'none' : 'transform 300ms ease-out',
          }}
        >
          <div className={`flashcard-inner ${flashcardFlipped ? 'flipped' : ''}`}>
            {/* Front (word) */}
            <div
              className="flashcard-front bg-white dark:bg-paper-dark border-[3px] border-pencil dark:border-pencil-dark p-8"
              style={{ borderRadius: wobblyMd, boxShadow: '6px 6px 0px 0px rgba(45,45,45,0.15)' }}
            >
              <p className="font-body text-xs uppercase tracking-[0.18em] text-pencil/40 dark:text-pencil-dark/40 mb-3">
                {card.type.replace(/_/g, ' ')}
              </p>
              <p className="font-heading text-4xl md:text-5xl text-pencil dark:text-pencil-dark mb-3">
                {card.prompt}
              </p>
              <p className="font-body text-sm text-pencil/30">Tap to flip</p>
              {flashcardSwipeX < -30 && <p className="font-body text-xs text-marker mt-2">← Swipe for next</p>}
              {flashcardSwipeX > 30 && <p className="font-body text-xs text-pen mt-2">Swipe for prev →</p>}
            </div>

            {/* Back (translation) */}
            <div
              className="flashcard-back bg-postit border-[3px] border-pencil dark:border-pencil-dark p-8"
              style={{ borderRadius: wobblyMd, boxShadow: '6px 6px 0px 0px rgba(45,45,45,0.15)' }}
            >
              <p className="font-heading text-3xl md:text-4xl text-pencil mb-2">
                {card.answer}
              </p>
              {card.exampleSentence && (
                <p className="font-body text-sm text-pencil/50 italic mt-4">
                  &ldquo;{card.exampleSentence}&rdquo;
                </p>
              )}
              <p className="font-body text-xs text-pencil/30 mt-2">Tap to flip back</p>
            </div>
          </div>
        </div>

        {/* Card stack visualization */}
        {flashcards.length > 1 && (
          <div className="relative -mt-2 w-full max-w-md" aria-hidden="true">
            <div className="h-3 mx-4 bg-erased dark:bg-erased-dark border border-pencil/10" style={{ borderRadius: '0 0 12px 12px' }} />
            {flashcards.length > 2 && (
              <div className="h-2 mx-8 -mt-0.5 bg-erased/60 dark:bg-erased-dark/60 border border-pencil/5" style={{ borderRadius: '0 0 12px 12px' }} />
            )}
          </div>
        )}

        <div className="flex items-center gap-4 mt-8">
          <button
            onClick={() => { setFlashcardIndex(Math.max(0, flashcardIndex - 1)); setFlashcardFlipped(false) }}
            className="px-6 py-2 font-body text-lg border-2 border-pencil dark:border-pencil-dark bg-white dark:bg-paper-dark hover:bg-erased dark:hover:bg-erased-dark transition-colors active:scale-95 touch-target"
            style={{ borderRadius: wobbly }}
            disabled={flashcardIndex === 0}
          >
            ← Previous
          </button>
          <button
            onClick={() => speakWord(card.type === 'word_to_meaning' ? card.prompt : card.answer)}
            className="p-2.5 text-pencil/60 hover:text-pen touch-target"
            title="Pronounce"
            aria-label="Pronounce word"
          >
            <Volume2 size={22} />
          </button>
          <button
            onClick={() => { setFlashcardIndex(Math.min(flashcards.length - 1, flashcardIndex + 1)); setFlashcardFlipped(false) }}
            className="px-6 py-2 font-body text-lg border-2 border-pencil dark:border-pencil-dark bg-postit hover:bg-marker hover:text-white transition-colors active:scale-95 touch-target"
            style={{ borderRadius: wobbly }}
            disabled={flashcardIndex >= flashcards.length - 1}
          >
            Next →
          </button>
        </div>

        {/* Review grading */}
        <div className="flex items-center gap-3 mt-6">
          {([
            { grade: 'again' as const, label: 'Again' },
            { grade: 'hard' as const, label: 'Hard' },
            { grade: 'good' as const, label: 'Good' },
            { grade: 'easy' as const, label: 'Easy' },
          ]).map((button) => (
            <button
              key={button.grade}
              onClick={() => submitReview(button.grade)}
              className="px-4 py-1.5 font-body text-sm border-2 border-pencil dark:border-pencil-dark bg-white dark:bg-paper-dark hover:bg-erased dark:hover:bg-erased-dark transition-colors"
              style={{ borderRadius: wobbly }}
            >
              {button.label}
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
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all words..."
            className="py-2 pl-9 pr-3 text-sm"
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
        <Select
          value={sortBy}
          onChange={(value) => setSortBy(value as typeof sortBy)}
          options={[
            { value: 'newest', label: 'Newest first' },
            { value: 'oldest', label: 'Oldest first' },
            { value: 'alpha', label: 'A-Z' },
          ]}
        />

        {/* Group by (Feature #13) */}
        <Select
          value={groupBy}
          onChange={(value) => setGroupBy(value as typeof groupBy)}
          options={[
            { value: 'none', label: 'No grouping' },
            { value: 'date', label: 'By date' },
            { value: 'mastery', label: 'By mastery' },
            { value: 'letter', label: 'By letter' },
          ]}
        />

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
        <Select
          value={filterMastery}
          onChange={setFilterMastery}
          options={[
            { value: '', label: 'All levels' },
            { value: 'learning', label: 'Learning' },
            { value: 'familiar', label: 'Familiar' },
            { value: 'mastered', label: 'Mastered' },
          ]}
        />

        {/* Filter by document */}
        <Select
          value={filterDocId}
          onChange={setFilterDocId}
          options={[
            { value: '', label: 'All documents' },
            ...documents.map((document) => ({ value: document.id, label: document.title || 'Untitled' })),
          ]}
          className="max-w-[220px]"
        />

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

      {(flashcards.length > 0 || recommendations.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-pencil/10 dark:border-pencil-dark/10">
          {flashcards.length > 0 && (
            <span className="rounded-full bg-postit px-3 py-1 font-body text-xs text-pencil dark:bg-erased-dark dark:text-pencil-dark">
              {flashcards.length} review card{flashcards.length !== 1 ? 's' : ''} ready
            </span>
          )}
          {recommendations.slice(0, 4).map((entry) => (
            <span
              key={entry.id}
              className="rounded-full border border-pencil/15 bg-white px-3 py-1 font-body text-xs text-pencil/70 dark:border-pencil-dark/15 dark:bg-paper-dark dark:text-pencil-dark/70"
            >
              {entry.word}
            </span>
          ))}
        </div>
      )}

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
          <div className="text-center mt-16 animate-pop-in">
            <div className="text-5xl mb-4" aria-hidden="true">🔍</div>
            <p className="font-heading text-xl text-pencil/40 dark:text-pencil-dark/40">No words match your filters</p>
            <p className="font-body text-sm text-pencil/30 mt-2">Try adjusting your search or filters</p>
          </div>
        ) : viewMode === 'compact' ? (
          /* Compact list with grouping */
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <input type="checkbox" checked={selectedIds.size === filtered.length} onChange={selectAll} className="w-4 h-4" />
              <span className="font-body text-xs text-pencil/40">Select all</span>
            </div>
            {groupedSections.map((section) => (
              <div key={section.key}>
                {groupBy !== 'none' && (
                  <div className="vocab-section-header bg-paper/90 dark:bg-paper-dark/90 py-2 px-3 mt-3 mb-1 flex items-center gap-2 border-b-2 border-dashed border-pencil/15 dark:border-pencil-dark/15">
                    {groupBy === 'date' && <Calendar size={14} className="text-pen" />}
                    {groupBy === 'mastery' && <BarChart3 size={14} className="text-pen" />}
                    <span className="font-heading text-sm text-pencil dark:text-pencil-dark">{section.label}</span>
                    <span className="font-body text-xs text-pencil/40 ml-1">({section.items.length})</span>
                  </div>
                )}
                {section.items.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-3 py-1.5 border-b border-dashed border-pencil/10 dark:border-pencil-dark/10 hover:bg-erased/30 dark:hover:bg-erased-dark/30 group transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(entry.id)}
                      onChange={() => toggleSelect(entry.id)}
                      className="w-4 h-4 flex-shrink-0"
                    />
                    <button onClick={() => toggleStar(entry.id)} className={`flex-shrink-0 ${entry.starred ? 'star-burst' : ''}`}>
                      {entry.starred ? <Star size={14} className="text-yellow-500 fill-yellow-500" /> : <StarOff size={14} className="text-pencil/20" />}
                    </button>
                    <span className="font-body text-base font-bold text-pencil dark:text-pencil-dark min-w-[120px]">{highlightMatch(entry.word)}</span>
                    <span className="font-body text-base text-pen dark:text-blue-300 flex-1">{highlightMatch(entry.translation)}</span>
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
                      className="bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark p-4 transition-all duration-150 hover:rotate-[0.5deg] hover:-translate-y-0.5 active:scale-[0.98]"
                      style={{ borderRadius: wobblyMd, boxShadow: '3px 3px 0px 0px rgba(45,45,45,0.1)' }}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-heading text-xl text-pencil dark:text-pencil-dark">{highlightMatch(entry.word)}</h4>
                        <button onClick={() => toggleStar(entry.id)} className={entry.starred ? 'star-burst' : ''}>
                          {entry.starred ? <Star size={16} className="text-yellow-500 fill-yellow-500" /> : <StarOff size={16} className="text-pencil/20" />}
                        </button>
                      </div>
                      <p className="font-body text-lg text-pen dark:text-blue-300 mb-2">{highlightMatch(entry.translation)}</p>
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
                    <td className="py-2 font-body font-bold text-pencil dark:text-pencil-dark">{highlightMatch(entry.word)}</td>
                    <td className="py-2 font-body text-pen dark:text-blue-300">{highlightMatch(entry.translation)}</td>
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
                      <Select
                        value={entry.mastery}
                        onChange={(value) => updateEntry(entry.id, { mastery: value as VocabularyEntry['mastery'] })}
                        options={[
                          { value: 'learning', label: 'Learning' },
                          { value: 'familiar', label: 'Familiar' },
                          { value: 'mastered', label: 'Mastered' },
                        ]}
                        className="min-w-[130px]"
                      />
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
