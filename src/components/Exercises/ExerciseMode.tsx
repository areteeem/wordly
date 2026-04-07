import { useMemo, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  GripVertical,
  Lightbulb,
  Printer,
  RefreshCw,
  RotateCcw,
  Target,
  X,
} from 'lucide-react'
import { useVocabularyStore } from '../../stores/vocabularyStore'
import { useDocumentStore } from '../../stores/documentStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { wobbly, wobblyMd } from '../../lib/utils'
import type { VocabularyEntry } from '../../types'

type ExerciseType =
  | 'fill-blanks'
  | 'type-in'
  | 'multiple-choice'
  | 'word-bank'
  | 'match-pairs'
  | 'scramble'

interface ExerciseProps {
  onClose: () => void
}

interface MatchCard {
  id: string
  pairId: string
  value: string
  side: 'word' | 'translation'
}

const EXERCISE_OPTIONS: Array<{ type: ExerciseType; title: string; desc: string }> = [
  {
    type: 'fill-blanks',
    title: 'Fill in the Blanks',
    desc: 'Hide words in context and reveal them one at a time or all at once.',
  },
  {
    type: 'type-in',
    title: 'Type Translation',
    desc: 'Type translations with hints and retry only the answers that were wrong.',
  },
  {
    type: 'multiple-choice',
    title: 'Multiple Choice',
    desc: 'Choose the correct translation and get instant feedback as you go.',
  },
  {
    type: 'word-bank',
    title: 'Word Bank',
    desc: 'Use the sticky word bank with click-to-place and drag-and-drop.',
  },
  {
    type: 'match-pairs',
    title: 'Match Pairs',
    desc: 'Match every word card with its translation card as quickly as possible.',
  },
  {
    type: 'scramble',
    title: 'Word Scramble',
    desc: 'Unscramble letters to rebuild the source word from its translation.',
  },
]

export function ExerciseMode({ onClose }: ExerciseProps) {
  const entries = useVocabularyStore((s) => s.entries)
  const documents = useDocumentStore((s) => s.documents)
  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)
  const notify = useSettingsStore((s) => s.notify)

  const [exerciseType, setExerciseType] = useState<ExerciseType | null>(null)
  const [docFilter, setDocFilter] = useState(activeDocumentId || '')
  const [showAnswers, setShowAnswers] = useState(false)
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [shuffledEntries, setShuffledEntries] = useState<VocabularyEntry[]>([])
  const [revealedItems, setRevealedItems] = useState<Set<string>>(new Set())
  const [hintedItems, setHintedItems] = useState<Set<string>>(new Set())
  const [selectedBankWordId, setSelectedBankWordId] = useState<string | null>(null)
  const [draggedBankWordId, setDraggedBankWordId] = useState<string | null>(null)
  const [matchCards, setMatchCards] = useState<MatchCard[]>([])
  const [selectedPairCards, setSelectedPairCards] = useState<string[]>([])
  const [mismatchedPairCards, setMismatchedPairCards] = useState<string[]>([])
  const [matchedPairIds, setMatchedPairIds] = useState<Set<string>>(new Set())
  const [scramblePools, setScramblePools] = useState<Record<string, string[]>>({})
  const [scrambleUsedMarkers, setScrambleUsedMarkers] = useState<Record<string, string[]>>({})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  )

  const filteredEntries = useMemo(() => {
    let result = entries
    if (docFilter) result = result.filter((entry) => entry.documentId === docFilter)
    return result.length > 0 ? result : entries
  }, [entries, docFilter])

  const entryById = useMemo(
    () => new Map(shuffledEntries.map((entry) => [entry.id, entry] as const)),
    [shuffledEntries],
  )

  const selectedDragEntry = draggedBankWordId ? entryById.get(draggedBankWordId) ?? null : null

  const unassignedWordBankEntries = useMemo(
    () => shuffledEntries.filter((entry) => !Object.values(userAnswers).includes(entry.id)),
    [shuffledEntries, userAnswers],
  )

  const score = useMemo(() => {
    if (!exerciseType) return null
    if (!submitted && exerciseType !== 'match-pairs') return null

    const correct =
      exerciseType === 'match-pairs'
        ? matchedPairIds.size
        : getCorrectCount(exerciseType, shuffledEntries, userAnswers)

    return { correct, total: shuffledEntries.length }
  }, [exerciseType, matchedPairIds, shuffledEntries, submitted, userAnswers])

  const startExercise = (type: ExerciseType) => {
    const pool = shuffleArray(filteredEntries)
    const nextEntries = type === 'match-pairs' ? pool.slice(0, Math.min(pool.length, 8)) : pool

    setExerciseType(type)
    setShuffledEntries(nextEntries)
    setUserAnswers({})
    setSubmitted(false)
    setShowAnswers(false)
    setRevealedItems(new Set())
    setHintedItems(new Set())
    setSelectedBankWordId(null)
    setDraggedBankWordId(null)
    setSelectedPairCards([])
    setMismatchedPairCards([])
    setMatchedPairIds(new Set())
    setScrambleUsedMarkers({})

    if (type === 'match-pairs') {
      setMatchCards(createMatchCards(nextEntries))
      setScramblePools({})
      return
    }

    if (type === 'scramble') {
      setMatchCards([])
      setScramblePools(
        Object.fromEntries(nextEntries.map((entry) => [entry.id, createScrambleLetters(entry.word)])),
      )
      return
    }

    setMatchCards([])
    setScramblePools({})
  }

  const checkAnswers = () => {
    if (!exerciseType) return
    setSubmitted(true)
    const correct = getCorrectCount(exerciseType, shuffledEntries, userAnswers)
    notify(`${correct} / ${shuffledEntries.length} correct!`)
  }

  const retryWrongTranslations = () => {
    const nextAnswers: Record<string, string> = {}
    shuffledEntries.forEach((entry) => {
      if ((userAnswers[entry.id] || '').toLowerCase().trim() === entry.translation.toLowerCase().trim()) {
        nextAnswers[entry.id] = userAnswers[entry.id]
      }
    })
    setUserAnswers(nextAnswers)
    setSubmitted(false)
  }

  const retryWrongScrambles = () => {
    const nextAnswers: Record<string, string> = {}
    const nextMarkers: Record<string, string[]> = {}

    shuffledEntries.forEach((entry) => {
      if ((userAnswers[entry.id] || '').toLowerCase().trim() === entry.word.toLowerCase().trim()) {
        nextAnswers[entry.id] = userAnswers[entry.id]
        nextMarkers[entry.id] = scrambleUsedMarkers[entry.id] || []
      }
    })

    setUserAnswers(nextAnswers)
    setScrambleUsedMarkers(nextMarkers)
    setSubmitted(false)
  }

  const revealItem = (id: string) => {
    setRevealedItems((prev) => new Set(prev).add(id))
  }

  const showHint = (id: string) => {
    setHintedItems((prev) => new Set(prev).add(id))
  }

  const assignWordToSlot = (slotEntryId: string, wordEntryId: string) => {
    setUserAnswers((prev) => {
      const next = { ...prev }
      Object.keys(next).forEach((key) => {
        if (next[key] === wordEntryId) delete next[key]
      })
      next[slotEntryId] = wordEntryId
      return next
    })
    setSelectedBankWordId(null)
  }

  const removeWordFromSlot = (slotEntryId: string) => {
    setUserAnswers((prev) => {
      const next = { ...prev }
      delete next[slotEntryId]
      return next
    })
  }

  const removeAssignedWord = (wordEntryId: string) => {
    setUserAnswers((prev) => {
      const next = { ...prev }
      Object.keys(next).forEach((key) => {
        if (next[key] === wordEntryId) delete next[key]
      })
      return next
    })
  }

  const handleBankWordClick = (wordEntryId: string) => {
    if (submitted) return
    setSelectedBankWordId((prev) => (prev === wordEntryId ? null : wordEntryId))
  }

  const handleDropTargetClick = (entryId: string) => {
    if (submitted) return
    if (selectedBankWordId) {
      assignWordToSlot(entryId, selectedBankWordId)
      return
    }
    if (userAnswers[entryId]) {
      removeWordFromSlot(entryId)
    }
  }

  const handleWordBankDragEnd = ({ active, over }: DragEndEvent) => {
    const wordEntryId = active.data.current?.wordEntryId as string | undefined
    const slotEntryId = over?.data.current?.slotEntryId as string | undefined
    const dropZone = over?.data.current?.dropZone as string | undefined

    if (wordEntryId && slotEntryId) {
      assignWordToSlot(slotEntryId, wordEntryId)
    } else if (wordEntryId && dropZone === 'bank') {
      removeAssignedWord(wordEntryId)
    }

    setDraggedBankWordId(null)
  }

  const handlePairCardClick = (card: MatchCard) => {
    if (matchedPairIds.has(card.pairId) || selectedPairCards.includes(card.id)) return

    const nextSelected = [...selectedPairCards, card.id]
    setSelectedPairCards(nextSelected)

    if (nextSelected.length < 2) return

    const [firstId, secondId] = nextSelected
    const first = matchCards.find((item) => item.id === firstId)
    const second = matchCards.find((item) => item.id === secondId)
    if (!first || !second) {
      setSelectedPairCards([])
      return
    }

    if (first.pairId === second.pairId && first.side !== second.side) {
      const nextMatched = new Set(matchedPairIds)
      nextMatched.add(first.pairId)
      setMatchedPairIds(nextMatched)
      setSelectedPairCards([])

      if (nextMatched.size === shuffledEntries.length) {
        setSubmitted(true)
        notify(`${nextMatched.size} / ${shuffledEntries.length} pairs matched!`)
      }
      return
    }

    setMismatchedPairCards(nextSelected)
    window.setTimeout(() => {
      setSelectedPairCards([])
      setMismatchedPairCards([])
    }, 650)
  }

  const handleMultipleChoiceSelection = (entryId: string, value: string) => {
    const nextAnswers = { ...userAnswers, [entryId]: value }
    setUserAnswers(nextAnswers)

    if (Object.keys(nextAnswers).length === shuffledEntries.length) {
      const correct = getCorrectCount('multiple-choice', shuffledEntries, nextAnswers)
      setSubmitted(true)
      notify(`${correct} / ${shuffledEntries.length} correct!`)
    }
  }

  const handleScrambleLetterClick = (entryId: string, letter: string, index: number) => {
    if (submitted) return
    const marker = `${letter}:${index}`
    const usedMarkers = scrambleUsedMarkers[entryId] || []
    if (usedMarkers.includes(marker)) return

    setUserAnswers((prev) => ({
      ...prev,
      [entryId]: `${prev[entryId] || ''}${letter}`,
    }))
    setScrambleUsedMarkers((prev) => ({
      ...prev,
      [entryId]: [...(prev[entryId] || []), marker],
    }))
  }

  const handleScrambleBackspace = (entryId: string) => {
    if (submitted) return
    const usedMarkers = scrambleUsedMarkers[entryId] || []
    if (usedMarkers.length === 0) return

    setUserAnswers((prev) => ({
      ...prev,
      [entryId]: (prev[entryId] || '').slice(0, -1),
    }))
    setScrambleUsedMarkers((prev) => ({
      ...prev,
      [entryId]: usedMarkers.slice(0, -1),
    }))
  }

  const handleScrambleClear = (entryId: string) => {
    if (submitted) return
    setUserAnswers((prev) => ({ ...prev, [entryId]: '' }))
    setScrambleUsedMarkers((prev) => ({ ...prev, [entryId]: [] }))
  }

  if (!exerciseType) {
    return (
      <div className="fixed inset-0 z-50 bg-paper dark:bg-paper-dark flex flex-col overflow-hidden animate-pop-in">
        <div className="flex items-center gap-4 p-4 border-b-2 border-dashed border-pencil/20 dark:border-pencil-dark/20">
          <button onClick={onClose} className="flex items-center gap-1 font-body text-sm text-pencil/60 hover:text-pencil">
            <ArrowLeft size={18} strokeWidth={2.5} /> Back
          </button>
          <div className="flex items-center gap-2" style={{ transform: 'rotate(-1deg)' }}>
            <Target size={24} strokeWidth={2.5} className="text-pencil dark:text-pencil-dark" />
            <h1 className="font-heading text-3xl text-pencil dark:text-pencil-dark">Exercises</h1>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
          <div className="max-w-5xl w-full space-y-6">
            <div className="mb-6">
              <label className="font-body text-sm text-pencil/60 mb-2 block">Practice words from:</label>
              <select
                value={docFilter}
                onChange={(e) => setDocFilter(e.target.value)}
                className="font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-3 py-2 outline-none w-full max-w-sm"
                style={{ borderRadius: wobbly }}
              >
                <option value="">All documents ({entries.length} words)</option>
                {documents.map((doc) => {
                  const count = entries.filter((entry) => entry.documentId === doc.id).length
                  return count > 0 ? (
                    <option key={doc.id} value={doc.id}>
                      {doc.title || 'Untitled'} ({count} words)
                    </option>
                  ) : null
                })}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {EXERCISE_OPTIONS.map(({ type, title, desc }) => (
                <button
                  key={type}
                  onClick={() => startExercise(type)}
                  disabled={filteredEntries.length < 2}
                  className="text-left bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark p-6 transition-all duration-100 hover:rotate-[0.5deg] hover:shadow-hard dark:hover:shadow-hard-dark disabled:opacity-40 disabled:hover:rotate-0"
                  style={{ borderRadius: wobblyMd, boxShadow: '3px 3px 0px 0px rgba(45,45,45,0.1)' }}
                >
                  <h3 className="font-heading text-2xl text-pencil dark:text-pencil-dark mb-2">{title}</h3>
                  <p className="font-body text-sm text-pencil/60 dark:text-pencil-dark/60">{desc}</p>
                </button>
              ))}
            </div>

            {filteredEntries.length < 2 && (
              <p className="font-body text-sm text-marker text-center">Add at least 2 words to start exercises.</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-paper dark:bg-paper-dark flex flex-col overflow-hidden">
      <div className="flex items-center gap-4 p-4 border-b-2 border-dashed border-pencil/20 dark:border-pencil-dark/20">
        <button onClick={() => setExerciseType(null)} className="flex items-center gap-1 font-body text-sm text-pencil/60 hover:text-pencil">
          <ArrowLeft size={18} strokeWidth={2.5} /> Back
        </button>
        <h2 className="font-heading text-2xl text-pencil dark:text-pencil-dark">
          {exerciseType === 'fill-blanks' && 'Fill in the Blanks'}
          {exerciseType === 'type-in' && 'Type Translation'}
          {exerciseType === 'multiple-choice' && 'Multiple Choice'}
          {exerciseType === 'word-bank' && 'Word Bank'}
          {exerciseType === 'match-pairs' && 'Match Pairs'}
          {exerciseType === 'scramble' && 'Word Scramble'}
        </h2>

        <div className="ml-auto flex items-center gap-3 flex-wrap">
          {score && (
            <span className="flex items-center gap-1 font-heading text-xl text-pen">
              <Check size={18} strokeWidth={3} />
              {score.correct}/{score.total}
            </span>
          )}

          <button
            onClick={() => startExercise(exerciseType)}
            className="flex items-center gap-1 font-body text-sm px-3 py-1.5 border-2 border-pencil dark:border-pencil-dark bg-white dark:bg-paper-dark hover:bg-erased transition-colors"
            style={{ borderRadius: wobbly }}
          >
            <RotateCcw size={14} /> Reset
          </button>

          {exerciseType === 'fill-blanks' && (
            <button
              onClick={() => setShowAnswers(!showAnswers)}
              className="flex items-center gap-1 font-body text-sm px-3 py-1.5 border-2 border-pencil dark:border-pencil-dark bg-white dark:bg-paper-dark hover:bg-erased transition-colors"
              style={{ borderRadius: wobbly }}
            >
              {showAnswers ? <EyeOff size={14} /> : <Eye size={14} />}
              {showAnswers ? 'Hide All' : 'Show All'}
            </button>
          )}

          {!submitted && (exerciseType === 'type-in' || exerciseType === 'scramble') && (
            <button
              onClick={checkAnswers}
              className="flex items-center gap-1 font-body text-sm px-4 py-1.5 border-2 border-pencil dark:border-pencil-dark bg-postit hover:bg-marker hover:text-white transition-colors"
              style={{ borderRadius: wobbly }}
            >
              <Check size={14} /> Check
            </button>
          )}

          {submitted && exerciseType === 'type-in' && score && score.correct < score.total && (
            <button
              onClick={retryWrongTranslations}
              className="flex items-center gap-1 font-body text-sm px-4 py-1.5 border-2 border-pencil dark:border-pencil-dark bg-postit hover:bg-marker hover:text-white transition-colors"
              style={{ borderRadius: wobbly }}
            >
              <RefreshCw size={14} /> Retry Wrong
            </button>
          )}

          {submitted && exerciseType === 'scramble' && score && score.correct < score.total && (
            <button
              onClick={retryWrongScrambles}
              className="flex items-center gap-1 font-body text-sm px-4 py-1.5 border-2 border-pencil dark:border-pencil-dark bg-postit hover:bg-marker hover:text-white transition-colors"
              style={{ borderRadius: wobbly }}
            >
              <RefreshCw size={14} /> Retry Wrong
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="p-1.5 text-pencil/40 hover:text-pencil"
            title="Print exercise"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {exerciseType === 'fill-blanks' && shuffledEntries.map((entry, index) => {
            const isRevealed = showAnswers || revealedItems.has(entry.id)

            return (
              <div
                key={entry.id}
                className="bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark p-4 flex items-start gap-2"
                style={{ borderRadius: wobblyMd }}
              >
                <span className="font-heading text-sm text-pencil/40 mt-0.5">{index + 1}.</span>
                <div className="flex-1">
                  <span className="font-body text-base text-pencil dark:text-pencil-dark">
                    {entry.contextSentence ? (
                      entry.contextSentence
                        .split(new RegExp(`(${entry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
                        .map((part, partIndex) =>
                          part.toLowerCase() === entry.word.toLowerCase() ? (
                            <span
                              key={partIndex}
                              className={`inline-block min-w-[80px] border-b-2 border-dashed border-pencil/40 mx-1 text-center transition-colors duration-300 ${
                                isRevealed
                                  ? 'text-pen font-bold bg-green-50 dark:bg-green-900/20 px-1 rounded'
                                  : 'text-transparent'
                              }`}
                            >
                              {isRevealed ? entry.word : '________'}
                            </span>
                          ) : (
                            <span key={partIndex}>{part}</span>
                          ),
                        )
                    ) : (
                      <>
                        <span className={`inline-block min-w-[80px] border-b-2 border-dashed border-pencil/40 mx-1 text-center ${isRevealed ? 'text-pen font-bold' : 'text-transparent'}`}>
                          {isRevealed ? entry.word : '________'}
                        </span>
                        <span className="text-pencil/50 ml-2">({entry.translation})</span>
                      </>
                    )}
                  </span>
                </div>
                {!isRevealed && (
                  <button
                    onClick={() => revealItem(entry.id)}
                    className="p-1 text-pencil/30 hover:text-pen transition-colors flex-shrink-0"
                    title="Reveal this answer"
                  >
                    <Eye size={16} strokeWidth={2} />
                  </button>
                )}
              </div>
            )
          })}

          {exerciseType === 'type-in' && shuffledEntries.map((entry, index) => {
            const isCorrect = submitted && (userAnswers[entry.id] || '').toLowerCase().trim() === entry.translation.toLowerCase().trim()
            const isWrong = submitted && Boolean(userAnswers[entry.id]) && !isCorrect
            const hasHint = hintedItems.has(entry.id)

            return (
              <div
                key={entry.id}
                className={`bg-white dark:bg-paper-dark border-2 p-4 flex items-center gap-3 transition-colors ${
                  isCorrect
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : isWrong
                      ? 'border-marker bg-red-50 dark:bg-red-900/20'
                      : 'border-pencil dark:border-pencil-dark'
                }`}
                style={{ borderRadius: wobblyMd }}
              >
                <span className="font-heading text-sm text-pencil/40 w-6">{index + 1}.</span>
                <div className="flex-1 min-w-0">
                  <span className="font-heading text-xl text-pencil dark:text-pencil-dark">{entry.word}</span>
                  {hasHint && !submitted && (
                    <span className="ml-2 font-body text-sm text-pencil/40 italic">
                      hint: {getTranslationHint(entry.translation)}
                    </span>
                  )}
                  {entry.contextSentence && (
                    <p className="font-body text-xs text-pencil/40 italic mt-0.5 truncate">&ldquo;{entry.contextSentence}&rdquo;</p>
                  )}
                </div>
                <span className="text-pencil/30">=</span>
                <input
                  type="text"
                  value={userAnswers[entry.id] || ''}
                  onChange={(e) => setUserAnswers({ ...userAnswers, [entry.id]: e.target.value })}
                  disabled={submitted && isCorrect}
                  placeholder="Type translation..."
                  className="w-40 md:w-56 font-body text-base bg-transparent border-b-2 border-dashed border-pencil/30 outline-none text-pen dark:text-blue-300 px-2 py-1"
                />
                {!submitted && !hasHint && (
                  <button
                    onClick={() => showHint(entry.id)}
                    className="p-1 text-pencil/25 hover:text-yellow-500 transition-colors flex-shrink-0"
                    title="Show hint"
                  >
                    <Lightbulb size={16} strokeWidth={2} />
                  </button>
                )}
                {isCorrect && <Check size={18} className="text-green-600 flex-shrink-0" />}
                {isWrong && <span className="font-body text-sm text-marker flex-shrink-0 whitespace-nowrap">{entry.translation}</span>}
              </div>
            )
          })}

          {exerciseType === 'multiple-choice' && shuffledEntries.map((entry, index) => {
            const options = generateDistractors(entry, entries)
            const selected = userAnswers[entry.id]
            const isAnswered = selected !== undefined

            return (
              <div
                key={entry.id}
                className="bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark p-4"
                style={{ borderRadius: wobblyMd }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-heading text-sm text-pencil/40">{index + 1}.</span>
                  <span className="font-heading text-xl text-pencil dark:text-pencil-dark">{entry.word}</span>
                  {entry.contextSentence && (
                    <span className="font-body text-xs text-pencil/40 italic ml-2 truncate max-w-[220px]">
                      &ldquo;{entry.contextSentence.slice(0, 56)}...&rdquo;
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {options.map((option, optionIndex) => {
                    const isSelected = selected === option
                    const isCorrectOption = option === entry.translation
                    let style = 'bg-white dark:bg-paper-dark border-pencil/30 hover:bg-erased dark:hover:bg-erased-dark'

                    if (isAnswered) {
                      if (isCorrectOption) style = 'bg-green-100 border-green-500 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      else if (isSelected) style = 'bg-red-100 border-marker text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    } else if (isSelected) {
                      style = 'bg-postit border-pencil'
                    }

                    return (
                      <button
                        key={`${entry.id}-${optionIndex}`}
                        onClick={() => !isAnswered && handleMultipleChoiceSelection(entry.id, option)}
                        className={`font-body text-base px-4 py-2 border-2 transition-colors text-left ${style}`}
                        style={{ borderRadius: wobbly }}
                        disabled={isAnswered}
                      >
                        {String.fromCharCode(65 + optionIndex)}. {option}
                      </button>
                    )
                  })}
                </div>

                {isAnswered && entry.contextSentence && (
                  <p className="mt-2 font-body text-xs text-pencil/50 italic border-l-2 border-dashed border-pencil/20 pl-2">
                    &ldquo;{entry.contextSentence}&rdquo;
                  </p>
                )}
              </div>
            )
          })}

          {exerciseType === 'word-bank' && (
            <>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={({ active }) => {
                  const wordEntryId = (active.data.current?.wordEntryId as string) ?? null
                  setDraggedBankWordId(wordEntryId)
                  setSelectedBankWordId(wordEntryId)
                }}
                onDragEnd={handleWordBankDragEnd}
                onDragCancel={() => setDraggedBankWordId(null)}
              >
                <WordBankDropZone>
                  <div
                    className="sticky top-0 z-20 mb-6 border-2 border-dashed border-pencil/30 bg-paper/95 p-4 backdrop-blur dark:bg-paper-dark/95"
                    style={{ borderRadius: wobblyMd }}
                  >
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-heading text-sm text-pencil/70 dark:text-pencil-dark/70">Word Bank</h3>
                        <p className="font-body text-xs text-pencil/45 dark:text-pencil-dark/45">
                          Click a word and then a slot, or drag a word onto its translation. Drop a word back here to unassign it.
                        </p>
                      </div>
                      <span className="font-body text-xs text-pencil/45 dark:text-pencil-dark/45">
                        {unassignedWordBankEntries.length} remaining
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {unassignedWordBankEntries.map((entry) => (
                        <DraggableWordChip
                          key={entry.id}
                          wordEntryId={entry.id}
                          label={entry.word}
                          isSelected={selectedBankWordId === entry.id}
                          onClick={() => handleBankWordClick(entry.id)}
                        />
                      ))}
                      {unassignedWordBankEntries.length === 0 && (
                        <span className="font-body text-sm text-pencil/40 italic py-1">All words are placed.</span>
                      )}
                    </div>
                  </div>
                </WordBankDropZone>

                {shuffledEntries.map((entry, index) => {
                  const matchedWordId = userAnswers[entry.id]
                  const matchedEntry = matchedWordId ? entryById.get(matchedWordId) ?? null : null
                  const isCorrect = submitted && matchedWordId === entry.id
                  const isWrong = submitted && Boolean(matchedWordId) && matchedWordId !== entry.id

                  return (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-4 bg-white dark:bg-paper-dark border-2 p-3 transition-colors ${
                        isCorrect ? 'border-green-500' : isWrong ? 'border-marker' : 'border-pencil dark:border-pencil-dark'
                      }`}
                      style={{ borderRadius: wobblyMd }}
                    >
                      <span className="font-heading text-sm text-pencil/40 w-6">{index + 1}.</span>
                      <DroppableWordSlot
                        slotEntryId={entry.id}
                        activeSelection={selectedBankWordId}
                        hasValue={Boolean(matchedEntry)}
                        onClick={() => handleDropTargetClick(entry.id)}
                      >
                        {matchedEntry ? (
                          <DraggableWordChip
                            wordEntryId={matchedEntry.id}
                            label={matchedEntry.word}
                            onClick={() => removeWordFromSlot(entry.id)}
                          />
                        ) : (
                          <span className="text-pencil/30 text-sm">
                            {selectedBankWordId ? 'Click to place' : 'Select or drag a word'}
                          </span>
                        )}
                      </DroppableWordSlot>
                      <GripVertical size={16} strokeWidth={2} className="text-pencil/20" />
                      <span className="font-body text-lg text-pen dark:text-blue-300 flex-1">{entry.translation}</span>
                      {isCorrect && <Check size={18} className="text-green-600" />}
                      {isWrong && <X size={18} className="text-marker" />}
                    </div>
                  )
                })}

                <DragOverlay>
                  {selectedDragEntry ? (
                    <div
                      className="flex items-center gap-2 border-2 border-pencil bg-white px-3 py-1.5 font-body text-base shadow-hard dark:border-pencil-dark dark:bg-paper-dark"
                      style={{ borderRadius: wobbly }}
                    >
                      <GripVertical size={12} strokeWidth={2} className="text-pencil/30" />
                      {selectedDragEntry.word}
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>

              {!submitted && (
                <button
                  onClick={() => {
                    setSubmitted(true)
                    const correct = shuffledEntries.filter((entry) => userAnswers[entry.id] === entry.id).length
                    notify(`${correct} / ${shuffledEntries.length} correct!`)
                  }}
                  className="mt-4 flex items-center gap-2 font-body text-base px-6 py-2 border-2 border-pencil dark:border-pencil-dark bg-postit hover:bg-marker hover:text-white transition-colors mx-auto"
                  style={{ borderRadius: wobbly }}
                >
                  <Check size={16} /> Check Answers
                </button>
              )}
            </>
          )}

          {exerciseType === 'match-pairs' && (
            <div className="space-y-4">
              <p className="font-body text-sm text-pencil/50 dark:text-pencil-dark/50">
                Match each word with its translation. Correct matches lock in immediately.
              </p>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {matchCards.map((card) => {
                  const isSelected = selectedPairCards.includes(card.id)
                  const isMatched = matchedPairIds.has(card.pairId)
                  const isWrong = mismatchedPairCards.includes(card.id)

                  return (
                    <button
                      key={card.id}
                      onClick={() => handlePairCardClick(card)}
                      disabled={isMatched}
                      className={`border-2 px-4 py-4 text-left transition-all ${
                        isMatched
                          ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                          : isWrong
                            ? 'border-marker bg-red-50 text-marker dark:bg-red-900/20'
                            : isSelected
                              ? 'border-pen bg-postit/70 text-pencil dark:bg-blue-900/20'
                              : 'border-pencil bg-white hover:bg-erased/50 dark:border-pencil-dark dark:bg-paper-dark dark:hover:bg-erased-dark/50'
                      }`}
                      style={{ borderRadius: wobblyMd }}
                    >
                      <div className="font-heading text-lg text-current">{card.value}</div>
                      <div className="mt-1 font-body text-xs text-current/70">
                        {card.side === 'word' ? 'Word card' : 'Translation card'}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {exerciseType === 'scramble' && shuffledEntries.map((entry, index) => {
            const builtValue = userAnswers[entry.id] || ''
            const isCorrect = submitted && builtValue.toLowerCase().trim() === entry.word.toLowerCase().trim()
            const isWrong = submitted && Boolean(builtValue) && !isCorrect
            const usedMarkers = new Set(scrambleUsedMarkers[entry.id] || [])

            return (
              <div
                key={entry.id}
                className={`border-2 p-4 transition-colors ${
                  isCorrect
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : isWrong
                      ? 'border-marker bg-red-50 dark:bg-red-900/20'
                      : 'border-pencil bg-white dark:border-pencil-dark dark:bg-paper-dark'
                }`}
                style={{ borderRadius: wobblyMd }}
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="font-heading text-sm text-pencil/40">{index + 1}.</span>
                  <span className="font-body text-lg text-pen dark:text-blue-300">{entry.translation}</span>
                  {!submitted && !hintedItems.has(entry.id) && (
                    <button
                      onClick={() => showHint(entry.id)}
                      className="ml-auto flex items-center gap-1 text-xs text-pencil/50 hover:text-pen"
                    >
                      <Lightbulb size={14} strokeWidth={2.5} />
                      Hint
                    </button>
                  )}
                </div>

                <div className="mb-3 flex min-h-[44px] items-center gap-2 border-2 border-dashed border-pencil/25 px-3 py-2" style={{ borderRadius: wobbly }}>
                  <span className="font-heading text-xl text-pencil dark:text-pencil-dark tracking-wide">
                    {builtValue || 'Build the word'}
                  </span>
                  {hintedItems.has(entry.id) && !submitted && (
                    <span className="ml-auto font-body text-xs text-pencil/45 dark:text-pencil-dark/45">
                      starts with {entry.word.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  {(scramblePools[entry.id] || []).map((letter, letterIndex) => {
                    const marker = `${letter}:${letterIndex}`
                    const isUsed = usedMarkers.has(marker)
                    return (
                      <button
                        key={marker}
                        onClick={() => handleScrambleLetterClick(entry.id, letter, letterIndex)}
                        disabled={isUsed || submitted}
                        className={`min-w-[40px] border-2 px-3 py-2 font-heading text-lg transition-colors ${
                          isUsed
                            ? 'border-pencil/15 bg-erased/60 text-pencil/25 dark:border-pencil-dark/15 dark:bg-erased-dark/60 dark:text-pencil-dark/25'
                            : 'border-pencil bg-white hover:bg-postit dark:border-pencil-dark dark:bg-paper-dark'
                        }`}
                        style={{ borderRadius: wobbly }}
                      >
                        {letter.toUpperCase()}
                      </button>
                    )
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleScrambleBackspace(entry.id)}
                    className="font-body text-sm text-pencil/60 hover:text-pencil"
                    disabled={!builtValue || submitted}
                  >
                    Backspace
                  </button>
                  <button
                    onClick={() => handleScrambleClear(entry.id)}
                    className="font-body text-sm text-pencil/60 hover:text-pencil"
                    disabled={!builtValue || submitted}
                  >
                    Clear
                  </button>
                  {isCorrect && <Check size={18} className="ml-auto text-green-600" />}
                  {isWrong && <span className="ml-auto font-body text-sm text-marker">Correct word: {entry.word}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function getCorrectCount(
  exerciseType: ExerciseType,
  shuffledEntries: VocabularyEntry[],
  answers: Record<string, string>,
) {
  if (exerciseType === 'word-bank') {
    return shuffledEntries.filter((entry) => answers[entry.id] === entry.id).length
  }

  if (exerciseType === 'scramble') {
    return shuffledEntries.filter(
      (entry) => (answers[entry.id] || '').toLowerCase().trim() === entry.word.toLowerCase().trim(),
    ).length
  }

  if (exerciseType === 'multiple-choice') {
    return shuffledEntries.filter((entry) => answers[entry.id] === entry.translation).length
  }

  return shuffledEntries.filter(
    (entry) => (answers[entry.id] || '').toLowerCase().trim() === entry.translation.toLowerCase().trim(),
  ).length
}

function getTranslationHint(translation: string) {
  return translation.length <= 2
    ? `${translation.charAt(0)}_`
    : `${translation.slice(0, 2)}${'_'.repeat(Math.max(1, translation.length - 2))}`
}

function generateDistractors(entry: VocabularyEntry, allEntries: VocabularyEntry[]) {
  const others = allEntries.filter((item) => item.id !== entry.id).map((item) => item.translation)
  const shuffled = shuffleArray(others).slice(0, 3)
  const options = shuffleArray([...shuffled, entry.translation])
  while (options.length < 4) options.push('—')
  return options
}

function createMatchCards(entries: VocabularyEntry[]) {
  return shuffleArray(
    entries.flatMap((entry) => [
      { id: `${entry.id}:word`, pairId: entry.id, value: entry.word, side: 'word' as const },
      {
        id: `${entry.id}:translation`,
        pairId: entry.id,
        value: entry.translation,
        side: 'translation' as const,
      },
    ]),
  )
}

function createScrambleLetters(word: string) {
  const letters = word.split('')
  if (letters.length < 2) return letters
  const shuffled = shuffleArray(letters)
  if (shuffled.join('').toLowerCase() === word.toLowerCase()) {
    return [...letters.slice(1), letters[0]]
  }
  return shuffled
}

function shuffleArray<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5)
}

function WordBankDropZone({ children }: { children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'word-bank-zone',
    data: { dropZone: 'bank' },
  })

  return (
    <div ref={setNodeRef} className={isOver ? 'rounded-lg ring-2 ring-pen/30' : ''}>
      {children}
    </div>
  )
}

function DroppableWordSlot({
  slotEntryId,
  activeSelection,
  hasValue,
  onClick,
  children,
}: {
  slotEntryId: string
  activeSelection: string | null
  hasValue: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `slot:${slotEntryId}`,
    data: { slotEntryId },
  })

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`min-w-[160px] min-h-[42px] border-2 border-dashed px-3 py-1 font-heading text-lg text-pencil dark:text-pencil-dark flex items-center cursor-pointer transition-colors ${
        isOver || (activeSelection && !hasValue)
          ? 'border-pen/50 bg-blue-50/50 dark:bg-blue-900/10'
          : hasValue
            ? 'bg-postit/50 border-pencil/30'
            : 'bg-erased/30 border-pencil/30'
      }`}
      style={{ borderRadius: wobbly }}
    >
      {children}
    </div>
  )
}

function DraggableWordChip({
  wordEntryId,
  label,
  isSelected,
  onClick,
}: {
  wordEntryId: string
  label: string
  isSelected?: boolean
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `word:${wordEntryId}`,
    data: { wordEntryId },
  })

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={(event) => {
        event.preventDefault()
        onClick()
      }}
      className={`flex items-center gap-2 border-2 px-3 py-1.5 font-body text-base transition-all select-none ${
        isSelected
          ? 'bg-pen text-white scale-105 shadow-hard-sm'
          : 'bg-white hover:bg-postit dark:border-pencil-dark dark:bg-paper-dark'
      } ${isDragging ? 'opacity-40' : ''}`}
      style={{
        transform: CSS.Translate.toString(transform),
        borderRadius: wobbly,
      }}
    >
      <GripVertical size={12} strokeWidth={2} className="text-current/60" />
      {label}
    </button>
  )
}