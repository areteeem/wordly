import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  BookOpenCheck,
  Check,
  Eye,
  EyeOff,
  Lightbulb,
  Printer,
  RefreshCw,
  RotateCcw,
  Target,
  Volume2,
  X,
} from 'lucide-react'
import { useVocabularyStore } from '../../stores/vocabularyStore'
import { useDocumentStore } from '../../stores/documentStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { buildFlashcardPrompts } from '../../lib/vocabulary'
import { wobbly, wobblyMd } from '../../lib/utils'
import { Confetti } from '../ui/Confetti'
import { Select } from '../ui/Select'
import type { FlashcardPrompt, ReviewGrade, VocabularyEntry } from '../../types'

type ExerciseType =
  | 'flashcards'
  | 'fortune-wheel'
  | 'fill-blanks'
  | 'type-in'
  | 'reverse-type-in'
  | 'multiple-choice'
  | 'context-clues'
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

interface FortuneWheelSettings {
  dueOnly: boolean
  excludeMastered: boolean
  weightedByWeakness: boolean
  removeAfterReview: boolean
  autoPronounce: boolean
  spinDurationMs: number
}

const EXERCISE_OPTIONS: Array<{ type: ExerciseType; title: string; desc: string }> = [
  {
    type: 'flashcards',
    title: 'Flashcard Review',
    desc: 'Run a due-first flashcard deck with reveal, grading, and keyboard shortcuts.',
  },
  {
    type: 'fortune-wheel',
    title: 'Fortune Wheel',
    desc: 'Spin a weighted practice wheel to pick one random vocabulary target at a time.',
  },
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
    type: 'reverse-type-in',
    title: 'Type the Word',
    desc: 'See the meaning first, then type the original word from memory.',
  },
  {
    type: 'multiple-choice',
    title: 'Multiple Choice',
    desc: 'Choose the correct translation and get instant feedback as you go.',
  },
  {
    type: 'context-clues',
    title: 'Context Clues',
    desc: 'Use the sentence context to choose the missing word, not just the translation.',
  },
  {
    type: 'word-bank',
    title: 'Word Bank',
    desc: 'Place words onto the right meanings with a lightweight matching board.',
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
  const entries = useVocabularyStore((state) => state.entries)
  const reviewEntry = useVocabularyStore((state) => state.reviewEntry)
  const documents = useDocumentStore((state) => state.documents)
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId)
  const notify = useSettingsStore((state) => state.notify)

  const [exerciseType, setExerciseType] = useState<ExerciseType | null>(null)
  const [docFilter, setDocFilter] = useState(activeDocumentId || '')
  const [showAnswers, setShowAnswers] = useState(false)
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [shuffledEntries, setShuffledEntries] = useState<VocabularyEntry[]>([])
  const [revealedItems, setRevealedItems] = useState<Set<string>>(new Set())
  const [hintedItems, setHintedItems] = useState<Set<string>>(new Set())
  const [selectedBankWordId, setSelectedBankWordId] = useState<string | null>(null)
  const [matchCards, setMatchCards] = useState<MatchCard[]>([])
  const [selectedPairCards, setSelectedPairCards] = useState<string[]>([])
  const [mismatchedPairCards, setMismatchedPairCards] = useState<string[]>([])
  const [matchedPairIds, setMatchedPairIds] = useState<Set<string>>(new Set())
  const [scramblePools, setScramblePools] = useState<Record<string, string[]>>({})
  const [scrambleUsedMarkers, setScrambleUsedMarkers] = useState<Record<string, string[]>>({})
  const [flashcardDeck, setFlashcardDeck] = useState<FlashcardPrompt[]>([])
  const [flashcardIndex, setFlashcardIndex] = useState(0)
  const [flashcardFlipped, setFlashcardFlipped] = useState(false)
  const [flashcardGrades, setFlashcardGrades] = useState<Record<string, ReviewGrade>>({})
  const [fortuneSettingsOpen, setFortuneSettingsOpen] = useState(false)
  const [fortuneSettings, setFortuneSettings] = useState<FortuneWheelSettings>({
    dueOnly: false,
    excludeMastered: false,
    weightedByWeakness: true,
    removeAfterReview: false,
    autoPronounce: false,
    spinDurationMs: 2800,
  })
  const [fortunePoolIds, setFortunePoolIds] = useState<string[]>([])
  const [fortuneRotation, setFortuneRotation] = useState(0)
  const [fortuneSelectedId, setFortuneSelectedId] = useState<string | null>(null)
  const [fortuneReveal, setFortuneReveal] = useState(false)
  const [fortuneSpinning, setFortuneSpinning] = useState(false)
  const [fortuneReviewedIds, setFortuneReviewedIds] = useState<Set<string>>(new Set())
  const [fortuneSessionTotal, setFortuneSessionTotal] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const [displayedScore, setDisplayedScore] = useState(0)
  const [scoreFlash, setScoreFlash] = useState<'correct' | 'wrong' | null>(null)
  const animatingScoreRef = useRef(false)

  const filteredEntries = useMemo(() => {
    let result = entries
    if (docFilter) {
      result = result.filter((entry) => entry.occurrences.some((occurrence) => occurrence.documentId === docFilter))
    }
    return result.length > 0 ? result : entries
  }, [docFilter, entries])

  const flashcardCandidates = useMemo(() => {
    const dueOnly = filteredEntries.some((entry) => entry.srs.dueAt <= Date.now() || entry.srs.reviewCount === 0)
    return buildFlashcardPrompts(filteredEntries, {
      documentId: docFilter || undefined,
      limit: 36,
      dueOnly,
    })
  }, [docFilter, filteredEntries])

  const fortuneCandidates = useMemo(() => {
    let result = filteredEntries

    if (fortuneSettings.dueOnly) {
      result = result.filter((entry) => entry.srs.dueAt <= Date.now() || entry.srs.reviewCount === 0)
    }

    if (fortuneSettings.excludeMastered) {
      result = result.filter((entry) => entry.mastery !== 'mastered')
    }

    return result
  }, [filteredEntries, fortuneSettings.dueOnly, fortuneSettings.excludeMastered])

  const entryById = useMemo(
    () => new Map(shuffledEntries.map((entry) => [entry.id, entry] as const)),
    [shuffledEntries],
  )

  const unassignedWordBankEntries = useMemo(
    () => shuffledEntries.filter((entry) => !Object.values(userAnswers).includes(entry.id)),
    [shuffledEntries, userAnswers],
  )

  const activeFlashcard = flashcardDeck[flashcardIndex] || null

  const fortunePool = useMemo(() => {
    const sourceIds = fortunePoolIds.length > 0 ? fortunePoolIds : fortuneCandidates.map((entry) => entry.id)
    const candidateMap = new Map(fortuneCandidates.map((entry) => [entry.id, entry] as const))
    return sourceIds
      .map((id) => candidateMap.get(id))
      .filter((entry): entry is VocabularyEntry => Boolean(entry))
  }, [fortuneCandidates, fortunePoolIds])

  const fortuneSelectedEntry = useMemo(
    () => entries.find((entry) => entry.id === fortuneSelectedId) || null,
    [entries, fortuneSelectedId],
  )

  const score = useMemo(() => {
    if (!exerciseType) return null
    if (exerciseType === 'flashcards') {
      return { correct: Object.keys(flashcardGrades).length, total: flashcardDeck.length }
    }
    if (exerciseType === 'fortune-wheel') {
      return { correct: fortuneReviewedIds.size, total: fortuneSessionTotal }
    }
    if (!submitted && exerciseType !== 'match-pairs') return null

    const correct =
      exerciseType === 'match-pairs'
        ? matchedPairIds.size
        : getCorrectCount(exerciseType, shuffledEntries, userAnswers)

    return { correct, total: shuffledEntries.length }
  }, [
    exerciseType,
    flashcardDeck.length,
    flashcardGrades,
    fortuneReviewedIds,
    fortuneSessionTotal,
    matchedPairIds,
    shuffledEntries,
    submitted,
    userAnswers,
  ])

  useEffect(() => {
    if (!score || animatingScoreRef.current) return
    if (displayedScore === score.correct) return

    animatingScoreRef.current = true
    const target = score.correct
    const step = target > displayedScore ? 1 : -1
    let current = displayedScore

    const interval = window.setInterval(() => {
      current += step
      setDisplayedScore(current)
      if (current === target) {
        window.clearInterval(interval)
        animatingScoreRef.current = false
      }
    }, 80)

    return () => {
      window.clearInterval(interval)
      animatingScoreRef.current = false
    }
  }, [displayedScore, score])

  useEffect(() => {
    if (!submitted || !score) return
    if (score.total > 0 && score.correct >= Math.ceil(score.total * 0.8)) {
      setShowConfetti(true)
    }
  }, [score, submitted])

  useEffect(() => {
    if (exerciseType !== 'flashcards' || !activeFlashcard) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"], .ProseMirror')) return

      if (event.key === ' ') {
        event.preventDefault()
        setFlashcardFlipped((current) => !current)
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setFlashcardIndex((current) => Math.max(0, current - 1))
        setFlashcardFlipped(false)
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        setFlashcardIndex((current) => Math.min(current + 1, Math.max(0, flashcardDeck.length - 1)))
        setFlashcardFlipped(false)
        return
      }

      const grade = ({
        '1': 'again',
        '2': 'hard',
        '3': 'good',
        '4': 'easy',
      } as const)[event.key]

      if (!grade) return
      event.preventDefault()
      submitFlashcardGrade(grade)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeFlashcard, exerciseType, flashcardDeck.length])

  useEffect(() => {
    if (exerciseType !== 'fortune-wheel') return
    setFortunePoolIds(fortuneCandidates.map((entry) => entry.id))
    setFortuneSelectedId(null)
    setFortuneReveal(false)
    setFortuneReviewedIds(new Set())
    setFortuneSessionTotal(fortuneCandidates.length)
    setSubmitted(false)
  }, [exerciseType, fortuneCandidates])

  const startExercise = (type: ExerciseType) => {
    const pool = shuffleArray(filteredEntries)
    const limitedPairs = pool.slice(0, Math.min(pool.length, 8))
    const nextEntries = type === 'match-pairs' ? limitedPairs : pool

    setExerciseType(type)
    setShuffledEntries(nextEntries)
    setUserAnswers({})
    setSubmitted(false)
    setShowAnswers(false)
    setRevealedItems(new Set())
    setHintedItems(new Set())
    setSelectedBankWordId(null)
    setMatchCards(type === 'match-pairs' ? createMatchCards(limitedPairs) : [])
    setSelectedPairCards([])
    setMismatchedPairCards([])
    setMatchedPairIds(new Set())
    setScramblePools(
      type === 'scramble'
        ? Object.fromEntries(nextEntries.map((entry) => [entry.id, createScrambleLetters(entry.word)]))
        : {},
    )
    setScrambleUsedMarkers({})
    setFlashcardDeck(type === 'flashcards' ? flashcardCandidates : [])
    setFlashcardIndex(0)
    setFlashcardFlipped(false)
    setFlashcardGrades({})
    setFortunePoolIds(type === 'fortune-wheel' ? fortuneCandidates.map((entry) => entry.id) : [])
    setFortuneRotation(0)
    setFortuneSelectedId(null)
    setFortuneReveal(false)
    setFortuneSpinning(false)
    setFortuneReviewedIds(new Set())
    setFortuneSessionTotal(type === 'fortune-wheel' ? fortuneCandidates.length : 0)
    setDisplayedScore(0)
    setScoreFlash(null)
    setShowConfetti(false)
  }

  const submitFlashcardGrade = (grade: ReviewGrade) => {
    if (!activeFlashcard) return

    reviewEntry(activeFlashcard.entryId, grade, activeFlashcard.type)
    setFlashcardGrades((current) => {
      const next = { ...current, [activeFlashcard.id]: grade }
      const reviewedCount = Object.keys(next).length
      if (flashcardDeck.length > 0 && reviewedCount >= flashcardDeck.length) {
        setSubmitted(true)
      }
      return next
    })
    setFlashcardFlipped(false)
    setFlashcardIndex((current) => Math.min(current + 1, Math.max(0, flashcardDeck.length - 1)))
    setScoreFlash(grade === 'again' ? 'wrong' : 'correct')
    window.setTimeout(() => setScoreFlash(null), 400)
  }

  const spinFortuneWheel = () => {
    if (fortunePool.length === 0 || fortuneSpinning) return

    const selectedEntry = pickFortuneWheelEntry(fortunePool, fortuneSettings.weightedByWeakness)
    const selectedIndex = fortunePool.findIndex((entry) => entry.id === selectedEntry.id)
    const segmentAngle = 360 / Math.max(1, fortunePool.length)
    const landingAngle = 360 - (selectedIndex + 0.5) * segmentAngle
    const fullTurns = Math.max(5, Math.round(fortuneSettings.spinDurationMs / 450)) * 360

    setFortuneSpinning(true)
    setFortuneSelectedId(null)
    setFortuneReveal(false)
    setFortuneRotation((current) => current + fullTurns + landingAngle)

    window.setTimeout(() => {
      setFortuneSpinning(false)
      setFortuneSelectedId(selectedEntry.id)
      if (fortuneSettings.autoPronounce) {
        speak(selectedEntry.word)
      }
    }, fortuneSettings.spinDurationMs)
  }

  const submitFortuneGrade = (grade: ReviewGrade) => {
    if (!fortuneSelectedEntry) return

    reviewEntry(fortuneSelectedEntry.id, grade, 'word_to_meaning')
    setFortuneReviewedIds((current) => {
      const next = new Set(current)
      next.add(fortuneSelectedEntry.id)
      if (fortuneSessionTotal > 0 && next.size >= fortuneSessionTotal) {
        setSubmitted(true)
      }
      return next
    })

    if (fortuneSettings.removeAfterReview) {
      setFortunePoolIds((current) => current.filter((id) => id !== fortuneSelectedEntry.id))
    }

    setScoreFlash(grade === 'again' ? 'wrong' : 'correct')
    window.setTimeout(() => setScoreFlash(null), 400)
  }

  const applyExerciseGrades = (
    type: ExerciseType,
    answers: Record<string, string>,
    matchedIds: Set<string> = new Set(),
  ) => {
    if (type === 'fill-blanks' || type === 'flashcards' || type === 'fortune-wheel') return

    shuffledEntries.forEach((entry) => {
      let grade: ReviewGrade = 'again'
      let cardType: 'word_to_meaning' | 'meaning_to_word' | 'context_to_word' = 'word_to_meaning'

      if (type === 'multiple-choice') {
        grade = answers[entry.id] === entry.translation ? 'good' : 'again'
        cardType = 'word_to_meaning'
      } else if (type === 'type-in') {
        const isCorrect = normalizeAnswer(answers[entry.id]) === normalizeAnswer(entry.translation)
        grade = isCorrect ? (hintedItems.has(entry.id) ? 'hard' : 'good') : 'again'
        cardType = 'word_to_meaning'
      } else if (type === 'reverse-type-in') {
        const isCorrect = normalizeAnswer(answers[entry.id]) === normalizeAnswer(entry.word)
        grade = isCorrect ? (hintedItems.has(entry.id) ? 'hard' : 'good') : 'again'
        cardType = 'meaning_to_word'
      } else if (type === 'context-clues') {
        grade = answers[entry.id] === entry.word ? 'good' : 'again'
        cardType = 'context_to_word'
      } else if (type === 'word-bank') {
        grade = answers[entry.id] === entry.id ? 'good' : 'again'
        cardType = 'meaning_to_word'
      } else if (type === 'match-pairs') {
        grade = matchedIds.has(entry.id) ? 'easy' : 'again'
        cardType = 'meaning_to_word'
      } else if (type === 'scramble') {
        const isCorrect = normalizeAnswer(answers[entry.id]) === normalizeAnswer(entry.word)
        grade = isCorrect ? (hintedItems.has(entry.id) ? 'hard' : 'good') : 'again'
        cardType = 'meaning_to_word'
      }

      reviewEntry(entry.id, grade, cardType)
    })
  }

  const checkAnswers = () => {
    if (!exerciseType || exerciseType === 'flashcards' || exerciseType === 'fortune-wheel' || exerciseType === 'match-pairs') return

    const correct = getCorrectCount(exerciseType, shuffledEntries, userAnswers)
    setSubmitted(true)
    applyExerciseGrades(exerciseType, userAnswers)
    setScoreFlash(correct > shuffledEntries.length / 2 ? 'correct' : 'wrong')
    window.setTimeout(() => setScoreFlash(null), 600)
    notify(`${correct} / ${shuffledEntries.length} correct!`)
  }

  const retryWrongTypeInAnswers = (mode: 'translation' | 'word') => {
    const nextAnswers: Record<string, string> = {}
    shuffledEntries.forEach((entry) => {
      const expected = mode === 'translation' ? entry.translation : entry.word
      if (normalizeAnswer(userAnswers[entry.id]) === normalizeAnswer(expected)) {
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
      if (normalizeAnswer(userAnswers[entry.id]) === normalizeAnswer(entry.word)) {
        nextAnswers[entry.id] = userAnswers[entry.id]
        nextMarkers[entry.id] = scrambleUsedMarkers[entry.id] || []
      }
    })

    setUserAnswers(nextAnswers)
    setScrambleUsedMarkers(nextMarkers)
    setSubmitted(false)
  }

  const revealItem = (id: string) => {
    setRevealedItems((current) => new Set(current).add(id))
  }

  const showHint = (id: string) => {
    setHintedItems((current) => new Set(current).add(id))
  }

  const assignWordToSlot = (slotEntryId: string, wordEntryId: string) => {
    setUserAnswers((current) => {
      const next = { ...current }
      Object.keys(next).forEach((key) => {
        if (next[key] === wordEntryId) delete next[key]
      })
      next[slotEntryId] = wordEntryId
      return next
    })
    setSelectedBankWordId(null)
  }

  const removeWordFromSlot = (slotEntryId: string) => {
    setUserAnswers((current) => {
      const next = { ...current }
      delete next[slotEntryId]
      return next
    })
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
      setScoreFlash('correct')
      window.setTimeout(() => setScoreFlash(null), 400)

      if (nextMatched.size === shuffledEntries.length) {
        setSubmitted(true)
        applyExerciseGrades('match-pairs', {}, nextMatched)
        notify(`${nextMatched.size} / ${shuffledEntries.length} pairs matched!`)
      }
      return
    }

    setMismatchedPairCards(nextSelected)
    setScoreFlash('wrong')
    window.setTimeout(() => setScoreFlash(null), 400)
    window.setTimeout(() => {
      setSelectedPairCards([])
      setMismatchedPairCards([])
    }, 650)
  }

  const handleChoiceSelection = (type: 'multiple-choice' | 'context-clues', entryId: string, value: string) => {
    const nextAnswers = { ...userAnswers, [entryId]: value }
    setUserAnswers(nextAnswers)

    const entry = shuffledEntries.find((candidate) => candidate.id === entryId)
    if (entry) {
      const expected = type === 'multiple-choice' ? entry.translation : entry.word
      setScoreFlash(value === expected ? 'correct' : 'wrong')
      window.setTimeout(() => setScoreFlash(null), 400)
    }

    if (Object.keys(nextAnswers).length === shuffledEntries.length) {
      const correct = getCorrectCount(type, shuffledEntries, nextAnswers)
      setSubmitted(true)
      applyExerciseGrades(type, nextAnswers)
      notify(`${correct} / ${shuffledEntries.length} correct!`)
    }
  }

  const handleScrambleLetterClick = (entryId: string, letter: string, index: number) => {
    if (submitted) return
    const marker = `${letter}:${index}`
    const usedMarkers = scrambleUsedMarkers[entryId] || []
    if (usedMarkers.includes(marker)) return

    setUserAnswers((current) => ({
      ...current,
      [entryId]: `${current[entryId] || ''}${letter}`,
    }))
    setScrambleUsedMarkers((current) => ({
      ...current,
      [entryId]: [...(current[entryId] || []), marker],
    }))
  }

  const handleScrambleBackspace = (entryId: string) => {
    if (submitted) return
    const usedMarkers = scrambleUsedMarkers[entryId] || []
    if (usedMarkers.length === 0) return

    setUserAnswers((current) => ({
      ...current,
      [entryId]: (current[entryId] || '').slice(0, -1),
    }))
    setScrambleUsedMarkers((current) => ({
      ...current,
      [entryId]: usedMarkers.slice(0, -1),
    }))
  }

  const handleScrambleClear = (entryId: string) => {
    if (submitted) return
    setUserAnswers((current) => ({ ...current, [entryId]: '' }))
    setScrambleUsedMarkers((current) => ({ ...current, [entryId]: [] }))
  }

  const checkWordBankAnswers = () => {
    const correct = shuffledEntries.filter((entry) => userAnswers[entry.id] === entry.id).length
    setSubmitted(true)
    applyExerciseGrades('word-bank', userAnswers)
    setScoreFlash(correct > shuffledEntries.length / 2 ? 'correct' : 'wrong')
    window.setTimeout(() => setScoreFlash(null), 600)
    notify(`${correct} / ${shuffledEntries.length} correct!`)
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
              <Select
                value={docFilter}
                onChange={setDocFilter}
                options={[
                  { value: '', label: `All documents (${entries.length} words)` },
                  ...documents.flatMap((doc) => {
                    const count = entries.filter((entry) =>
                      entry.occurrences.some((occurrence) => occurrence.documentId === doc.id),
                    ).length
                    return count > 0 ? [{ value: doc.id, label: `${doc.title || 'Untitled'} (${count} words)` }] : []
                  }),
                ]}
                className="w-full max-w-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {EXERCISE_OPTIONS.map(({ type, title, desc }) => {
                const disabled =
                  filteredEntries.length < getExerciseMinimumCount(type)
                  || (type === 'flashcards' && flashcardCandidates.length === 0)
                  || (type === 'fortune-wheel' && fortuneCandidates.length === 0)

                return (
                  <button
                    key={type}
                    onClick={() => startExercise(type)}
                    disabled={disabled}
                    className="text-left bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark p-6 transition-all duration-100 hover:rotate-[0.5deg] hover:shadow-hard dark:hover:shadow-hard-dark disabled:opacity-40 disabled:hover:rotate-0 active:scale-[0.97] touch-target"
                    style={{ borderRadius: wobblyMd, boxShadow: '3px 3px 0px 0px rgba(45,45,45,0.1)' }}
                  >
                    <h3 className="font-heading text-2xl text-pencil dark:text-pencil-dark mb-2">{title}</h3>
                    <p className="font-body text-sm text-pencil/60 dark:text-pencil-dark/60">{desc}</p>
                    {type === 'flashcards' && flashcardCandidates.length > 0 && (
                      <p className="mt-3 font-body text-xs text-pen dark:text-blue-300">
                        {flashcardCandidates.length} due-first card{flashcardCandidates.length !== 1 ? 's' : ''} ready
                      </p>
                    )}
                    {type === 'fortune-wheel' && fortuneCandidates.length > 0 && (
                      <p className="mt-3 font-body text-xs text-pen dark:text-blue-300">
                        {fortuneCandidates.length} word{fortuneCandidates.length !== 1 ? 's' : ''} in the wheel pool
                      </p>
                    )}
                  </button>
                )
              })}
            </div>

            {filteredEntries.length < 1 && (
              <p className="font-body text-sm text-marker text-center">Add at least 1 word to start practicing.</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-paper dark:bg-paper-dark flex flex-col overflow-hidden">
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
      <div className="flex items-center gap-4 p-4 border-b-2 border-dashed border-pencil/20 dark:border-pencil-dark/20">
        <button
          onClick={() => {
            setExerciseType(null)
            setShowConfetti(false)
          }}
          className="flex items-center gap-1 font-body text-sm text-pencil/60 hover:text-pencil touch-target"
        >
          <ArrowLeft size={18} strokeWidth={2.5} /> Back
        </button>
        <h2 className="font-heading text-2xl text-pencil dark:text-pencil-dark">{getExerciseTitle(exerciseType)}</h2>

        <div className="ml-auto flex items-center gap-3 flex-wrap">
          {score && (
            <span
              className={`flex items-center gap-1 font-heading text-xl transition-all duration-300 ${
                scoreFlash === 'correct'
                  ? 'text-green-600 scale-125'
                  : scoreFlash === 'wrong'
                    ? 'text-marker scale-90'
                    : 'text-pen'
              }`}
            >
              <Check size={18} strokeWidth={3} />
              <span className="tabular-nums">{displayedScore}</span>/{score.total}
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
              onClick={() => setShowAnswers((current) => !current)}
              className="flex items-center gap-1 font-body text-sm px-3 py-1.5 border-2 border-pencil dark:border-pencil-dark bg-white dark:bg-paper-dark hover:bg-erased transition-colors"
              style={{ borderRadius: wobbly }}
            >
              {showAnswers ? <EyeOff size={14} /> : <Eye size={14} />}
              {showAnswers ? 'Hide All' : 'Show All'}
            </button>
          )}

          {!submitted && (exerciseType === 'type-in' || exerciseType === 'reverse-type-in' || exerciseType === 'scramble') && (
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
              onClick={() => retryWrongTypeInAnswers('translation')}
              className="flex items-center gap-1 font-body text-sm px-4 py-1.5 border-2 border-pencil dark:border-pencil-dark bg-postit hover:bg-marker hover:text-white transition-colors"
              style={{ borderRadius: wobbly }}
            >
              <RefreshCw size={14} /> Retry Wrong
            </button>
          )}

          {submitted && exerciseType === 'reverse-type-in' && score && score.correct < score.total && (
            <button
              onClick={() => retryWrongTypeInAnswers('word')}
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

          <button onClick={() => window.print()} className="p-1.5 text-pencil/40 hover:text-pencil" title="Print exercise">
            <Printer size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {exerciseType === 'flashcards' && activeFlashcard && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border-2 border-dashed border-pencil/20 bg-white/80 px-4 py-3 dark:border-pencil-dark/20 dark:bg-paper-dark/80" style={{ borderRadius: wobblyMd }}>
                <div>
                  <div className="flex items-center gap-2 font-heading text-lg text-pencil dark:text-pencil-dark">
                    <BookOpenCheck size={18} strokeWidth={2.5} className="text-pen" />
                    Due-first flashcards
                  </div>
                  <p className="font-body text-xs text-pencil/50 dark:text-pencil-dark/50">
                    Space flips. Keys 1-4 grade. Arrow keys move through the deck.
                  </p>
                </div>
                <span className="rounded-full bg-postit px-3 py-1 font-body text-xs text-pencil dark:bg-erased-dark dark:text-pencil-dark">
                  {flashcardIndex + 1} / {flashcardDeck.length}
                </span>
              </div>

              <div className="flashcard-3d mx-auto w-full max-w-3xl aspect-[16/10] cursor-pointer select-none" onClick={() => setFlashcardFlipped((current) => !current)}>
                <div className={`flashcard-inner ${flashcardFlipped ? 'flipped' : ''}`}>
                  <div
                    className="flashcard-front flex h-full flex-col justify-between border-[3px] border-pencil bg-white p-8 dark:border-pencil-dark dark:bg-paper-dark"
                    style={{ borderRadius: wobblyMd, boxShadow: '6px 6px 0px 0px rgba(45,45,45,0.15)' }}
                  >
                    <div>
                      <p className="font-body text-xs uppercase tracking-[0.18em] text-pencil/40 dark:text-pencil-dark/40">
                        {activeFlashcard.type.replace(/_/g, ' ')}
                      </p>
                      <p className="mt-5 font-heading text-4xl leading-tight text-pencil dark:text-pencil-dark md:text-5xl">
                        {activeFlashcard.prompt}
                      </p>
                    </div>
                    <p className="font-body text-sm text-pencil/35 dark:text-pencil-dark/35">Tap or press Space to reveal.</p>
                  </div>

                  <div
                    className="flashcard-back flex h-full flex-col justify-between border-[3px] border-pencil bg-postit p-8 dark:border-pencil-dark dark:bg-erased-dark"
                    style={{ borderRadius: wobblyMd, boxShadow: '6px 6px 0px 0px rgba(45,45,45,0.15)' }}
                  >
                    <div>
                      <p className="font-body text-xs uppercase tracking-[0.18em] text-pencil/40">Answer</p>
                      <p className="mt-5 font-heading text-4xl leading-tight text-pencil md:text-5xl">{activeFlashcard.answer}</p>
                      {activeFlashcard.exampleSentence && (
                        <p className="mt-5 border-l-2 border-dashed border-pencil/20 pl-3 font-body text-sm italic text-pencil/60">
                          &ldquo;{activeFlashcard.exampleSentence}&rdquo;
                        </p>
                      )}
                    </div>
                    <p className="font-body text-sm text-pencil/35">Grade the card or flip back.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => {
                    setFlashcardIndex((current) => Math.max(0, current - 1))
                    setFlashcardFlipped(false)
                  }}
                  className="px-5 py-2 font-body text-sm border-2 border-pencil dark:border-pencil-dark bg-white dark:bg-paper-dark hover:bg-erased dark:hover:bg-erased-dark transition-colors"
                  style={{ borderRadius: wobbly }}
                  disabled={flashcardIndex === 0}
                >
                  Previous
                </button>
                <button
                  onClick={() => speak(activeFlashcard.type === 'word_to_meaning' ? activeFlashcard.prompt : activeFlashcard.answer)}
                  className="p-2.5 text-pencil/60 hover:text-pen transition-colors"
                  title="Pronounce"
                  aria-label="Pronounce card"
                >
                  <Volume2 size={22} />
                </button>
                <button
                  onClick={() => {
                    setFlashcardIndex((current) => Math.min(current + 1, Math.max(0, flashcardDeck.length - 1)))
                    setFlashcardFlipped(false)
                  }}
                  className="px-5 py-2 font-body text-sm border-2 border-pencil dark:border-pencil-dark bg-postit hover:bg-marker hover:text-white transition-colors"
                  style={{ borderRadius: wobbly }}
                  disabled={flashcardIndex >= flashcardDeck.length - 1}
                >
                  Next
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                {([
                  { grade: 'again' as const, label: 'Again', shortcut: '1' },
                  { grade: 'hard' as const, label: 'Hard', shortcut: '2' },
                  { grade: 'good' as const, label: 'Good', shortcut: '3' },
                  { grade: 'easy' as const, label: 'Easy', shortcut: '4' },
                ]).map((button) => (
                  <button
                    key={button.grade}
                    onClick={() => submitFlashcardGrade(button.grade)}
                    className="flex items-center gap-2 px-4 py-2 font-body text-sm border-2 border-pencil dark:border-pencil-dark bg-white dark:bg-paper-dark hover:bg-erased dark:hover:bg-erased-dark transition-colors"
                    style={{ borderRadius: wobbly }}
                  >
                    <span>{button.label}</span>
                    <span className="font-mono text-xs text-pencil/50 dark:text-pencil-dark/50">{button.shortcut}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {exerciseType === 'fortune-wheel' && (
            <div className="space-y-5">
              <div className="rounded-[22px] border-2 border-dashed border-pencil/20 bg-white/80 p-4 dark:border-pencil-dark/20 dark:bg-paper-dark/80" style={{ borderRadius: wobblyMd }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-heading text-lg text-pencil dark:text-pencil-dark">Spin for a random study target</div>
                    <p className="font-body text-xs text-pencil/50 dark:text-pencil-dark/50">
                      Use the wheel when you want a surprise prompt instead of a full deck.
                    </p>
                  </div>
                  <button
                    onClick={() => setFortuneSettingsOpen((current) => !current)}
                    className="px-3 py-1.5 font-body text-sm border-2 border-pencil dark:border-pencil-dark bg-white dark:bg-paper-dark hover:bg-erased dark:hover:bg-erased-dark transition-colors"
                    style={{ borderRadius: wobbly }}
                  >
                    {fortuneSettingsOpen ? 'Hide advanced settings' : 'Advanced settings'}
                  </button>
                </div>

                {fortuneSettingsOpen && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <FortuneToggle
                      label="Due words only"
                      hint="Spin only from overdue or never-reviewed words."
                      checked={fortuneSettings.dueOnly}
                      onChange={(checked) => setFortuneSettings((current) => ({ ...current, dueOnly: checked }))}
                    />
                    <FortuneToggle
                      label="Exclude mastered"
                      hint="Skip words already marked as mastered."
                      checked={fortuneSettings.excludeMastered}
                      onChange={(checked) => setFortuneSettings((current) => ({ ...current, excludeMastered: checked }))}
                    />
                    <FortuneToggle
                      label="Weight by weakness"
                      hint="Bias the wheel toward difficult, weak, and mistake-prone entries."
                      checked={fortuneSettings.weightedByWeakness}
                      onChange={(checked) => setFortuneSettings((current) => ({ ...current, weightedByWeakness: checked }))}
                    />
                    <FortuneToggle
                      label="Remove after review"
                      hint="Take reviewed words out of the wheel for this session."
                      checked={fortuneSettings.removeAfterReview}
                      onChange={(checked) => setFortuneSettings((current) => ({ ...current, removeAfterReview: checked }))}
                    />
                    <FortuneToggle
                      label="Auto pronounce result"
                      hint="Speak the selected word automatically when the wheel stops."
                      checked={fortuneSettings.autoPronounce}
                      onChange={(checked) => setFortuneSettings((current) => ({ ...current, autoPronounce: checked }))}
                    />
                    <div className="rounded-[18px] border border-pencil/15 bg-paper/70 px-3 py-3 dark:border-pencil-dark/15 dark:bg-paper-dark/70">
                      <div className="font-body text-sm text-pencil dark:text-pencil-dark">Spin duration</div>
                      <div className="mt-2 flex items-center gap-3">
                        <input
                          type="range"
                          min={1200}
                          max={5000}
                          step={200}
                          value={fortuneSettings.spinDurationMs}
                          onChange={(event) => setFortuneSettings((current) => ({
                            ...current,
                            spinDurationMs: Number(event.target.value),
                          }))}
                          className="w-full"
                        />
                        <span className="font-body text-xs text-pencil/55 dark:text-pencil-dark/55">
                          {fortuneSettings.spinDurationMs}ms
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:items-start">
                <div className="rounded-[24px] border-2 border-pencil bg-white p-6 dark:border-pencil-dark dark:bg-paper-dark" style={{ borderRadius: wobblyMd }}>
                  <div className="relative mx-auto h-[320px] w-[320px] max-w-full">
                    <div className="absolute left-1/2 top-0 z-20 h-0 w-0 -translate-x-1/2 border-x-[16px] border-b-[24px] border-x-transparent border-b-marker" />
                    <div
                      className="relative h-full w-full rounded-full border-[6px] border-pencil dark:border-pencil-dark"
                      style={{
                        background: buildWheelGradient(fortunePool.length),
                        transform: `rotate(${fortuneRotation}deg)`,
                        transition: fortuneSpinning ? `transform ${fortuneSettings.spinDurationMs}ms cubic-bezier(0.18, 0.84, 0.18, 1)` : 'none',
                      }}
                    >
                      <div className="absolute inset-[24%] flex items-center justify-center rounded-full border-2 border-dashed border-pencil/20 bg-paper/90 px-4 text-center dark:border-pencil-dark/20 dark:bg-paper-dark/90">
                        <div>
                          <div className="font-heading text-2xl text-pencil dark:text-pencil-dark">
                            {fortuneSpinning ? 'Spinning...' : `${fortunePool.length}`}
                          </div>
                          <div className="font-body text-xs text-pencil/55 dark:text-pencil-dark/55">
                            {fortuneSpinning ? 'Finding your next word' : 'words in the wheel'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={spinFortuneWheel}
                      disabled={fortunePool.length === 0 || fortuneSpinning}
                      className="px-5 py-2 font-body text-sm border-2 border-pencil dark:border-pencil-dark bg-postit hover:bg-marker hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ borderRadius: wobbly }}
                    >
                      {fortuneSpinning ? 'Spinning...' : 'Spin the wheel'}
                    </button>
                    <button
                      onClick={() => {
                        setFortunePoolIds(fortuneCandidates.map((entry) => entry.id))
                        setFortuneSelectedId(null)
                        setFortuneReveal(false)
                        setFortuneReviewedIds(new Set())
                        setFortuneSessionTotal(fortuneCandidates.length)
                        setSubmitted(false)
                      }}
                      className="px-5 py-2 font-body text-sm border-2 border-pencil dark:border-pencil-dark bg-white dark:bg-paper-dark hover:bg-erased dark:hover:bg-erased-dark transition-colors"
                      style={{ borderRadius: wobbly }}
                    >
                      Reset pool
                    </button>
                  </div>
                </div>

                <div className="rounded-[24px] border-2 border-pencil bg-white p-5 dark:border-pencil-dark dark:bg-paper-dark" style={{ borderRadius: wobblyMd }}>
                  {fortuneSelectedEntry ? (
                    <div className="space-y-4">
                      <div>
                        <div className="font-body text-xs uppercase tracking-[0.18em] text-pencil/40 dark:text-pencil-dark/40">Selected word</div>
                        <div className="mt-2 font-heading text-3xl text-pencil dark:text-pencil-dark">{fortuneSelectedEntry.word}</div>
                        <div className="mt-1 font-body text-xs text-pencil/50 dark:text-pencil-dark/50">
                          Strength {fortuneSelectedEntry.strengthScore} · Difficulty {fortuneSelectedEntry.difficultyScore}
                        </div>
                      </div>

                      <button
                        onClick={() => setFortuneReveal((current) => !current)}
                        className="px-4 py-2 font-body text-sm border-2 border-pencil dark:border-pencil-dark bg-white dark:bg-paper-dark hover:bg-erased dark:hover:bg-erased-dark transition-colors"
                        style={{ borderRadius: wobbly }}
                      >
                        {fortuneReveal ? 'Hide answer' : 'Reveal answer'}
                      </button>

                      {fortuneReveal && (
                        <div className="rounded-[18px] border border-pencil/15 bg-postit/60 px-4 py-3 dark:border-pencil-dark/15 dark:bg-erased-dark/60">
                          <div className="font-heading text-2xl text-pen dark:text-blue-300">{fortuneSelectedEntry.translation}</div>
                          {fortuneSelectedEntry.contextSentence && (
                            <p className="mt-2 border-l-2 border-dashed border-pencil/20 pl-3 font-body text-sm italic text-pencil/60 dark:border-pencil-dark/20 dark:text-pencil-dark/60">
                              &ldquo;{fortuneSelectedEntry.contextSentence}&rdquo;
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {([
                          { grade: 'again' as const, label: 'Again' },
                          { grade: 'hard' as const, label: 'Hard' },
                          { grade: 'good' as const, label: 'Good' },
                          { grade: 'easy' as const, label: 'Easy' },
                        ]).map((button) => (
                          <button
                            key={button.grade}
                            onClick={() => submitFortuneGrade(button.grade)}
                            className="px-4 py-2 font-body text-sm border-2 border-pencil dark:border-pencil-dark bg-white dark:bg-paper-dark hover:bg-erased dark:hover:bg-erased-dark transition-colors"
                            style={{ borderRadius: wobbly }}
                          >
                            {button.label}
                          </button>
                        ))}
                        <button
                          onClick={() => speak(fortuneSelectedEntry.word)}
                          className="p-2.5 text-pencil/60 hover:text-pen transition-colors"
                          title="Pronounce"
                          aria-label="Pronounce word"
                        >
                          <Volume2 size={20} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="font-heading text-xl text-pencil dark:text-pencil-dark">No word selected yet</div>
                      <p className="font-body text-sm text-pencil/55 dark:text-pencil-dark/55">
                        Spin the wheel to pick a random word from your current practice pool.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {exerciseType === 'fill-blanks' && shuffledEntries.map((entry, index) => {
            const isRevealed = showAnswers || revealedItems.has(entry.id)
            const maskedSentence = entry.contextSentence
              ? entry.contextSentence.split(new RegExp(`(${escapeRegExp(entry.word)})`, 'gi'))
              : null

            return (
              <div
                key={entry.id}
                className="bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark p-4 flex items-start gap-2"
                style={{ borderRadius: wobblyMd }}
              >
                <span className="font-heading text-sm text-pencil/40 mt-0.5">{index + 1}.</span>
                <div className="flex-1">
                  <span className="font-body text-base text-pencil dark:text-pencil-dark">
                    {maskedSentence ? (
                      maskedSentence.map((part, partIndex) =>
                        normalizeAnswer(part) === normalizeAnswer(entry.word) ? (
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
            const isCorrect = submitted && normalizeAnswer(userAnswers[entry.id]) === normalizeAnswer(entry.translation)
            const isWrong = submitted && Boolean(userAnswers[entry.id]) && !isCorrect
            const hasHint = hintedItems.has(entry.id)

            return (
              <TypeExerciseRow
                key={entry.id}
                index={index}
                prompt={entry.word}
                value={userAnswers[entry.id] || ''}
                placeholder="Type translation..."
                hint={hasHint && !submitted ? getTranslationHint(entry.translation) : null}
                contextSentence={entry.contextSentence}
                isCorrect={isCorrect}
                isWrong={isWrong}
                answerLabel={isWrong ? entry.translation : null}
                onChange={(value) => setUserAnswers({ ...userAnswers, [entry.id]: value })}
                onHint={() => showHint(entry.id)}
                disabled={submitted && isCorrect}
              />
            )
          })}

          {exerciseType === 'reverse-type-in' && shuffledEntries.map((entry, index) => {
            const isCorrect = submitted && normalizeAnswer(userAnswers[entry.id]) === normalizeAnswer(entry.word)
            const isWrong = submitted && Boolean(userAnswers[entry.id]) && !isCorrect
            const hasHint = hintedItems.has(entry.id)

            return (
              <TypeExerciseRow
                key={entry.id}
                index={index}
                prompt={entry.translation}
                value={userAnswers[entry.id] || ''}
                placeholder="Type the word..."
                hint={hasHint && !submitted ? getWordHint(entry.word) : null}
                contextSentence={entry.contextSentence}
                isCorrect={isCorrect}
                isWrong={isWrong}
                answerLabel={isWrong ? entry.word : null}
                onChange={(value) => setUserAnswers({ ...userAnswers, [entry.id]: value })}
                onHint={() => showHint(entry.id)}
                disabled={submitted && isCorrect}
              />
            )
          })}

          {exerciseType === 'multiple-choice' && shuffledEntries.map((entry, index) => {
            const options = generateDistractors(entry, entries)
            const selected = userAnswers[entry.id]
            const isAnswered = selected !== undefined

            return (
              <ChoiceExerciseCard
                key={entry.id}
                index={index}
                title={entry.word}
                subtitle={entry.contextSentence ? `“${entry.contextSentence.slice(0, 56)}...”` : null}
                options={options}
                selected={selected}
                correctValue={entry.translation}
                onSelect={(value) => handleChoiceSelection('multiple-choice', entry.id, value)}
                showContext={isAnswered ? entry.contextSentence : null}
              />
            )
          })}

          {exerciseType === 'context-clues' && shuffledEntries.map((entry, index) => {
            const options = generateWordOptions(entry, entries)
            const selected = userAnswers[entry.id]
            const isAnswered = selected !== undefined
            const maskedSentence = entry.contextSentence
              ? entry.contextSentence.replace(new RegExp(`\\b${escapeRegExp(entry.word)}\\b`, 'gi'), '_____')
              : 'Choose the word that best fits the clue.'

            return (
              <ChoiceExerciseCard
                key={entry.id}
                index={index}
                title={maskedSentence}
                subtitle={`Meaning: ${entry.translation}`}
                options={options}
                selected={selected}
                correctValue={entry.word}
                onSelect={(value) => handleChoiceSelection('context-clues', entry.id, value)}
              />
            )
          })}

          {exerciseType === 'word-bank' && (
            <>
              <div
                className="sticky top-0 z-20 mb-6 border-2 border-dashed border-pencil/30 bg-paper/95 p-4 backdrop-blur dark:bg-paper-dark/95"
                style={{ borderRadius: wobblyMd }}
              >
                <div className="mb-2 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-heading text-sm text-pencil/70 dark:text-pencil-dark/70">Word Bank</h3>
                    <p className="font-body text-xs text-pencil/45 dark:text-pencil-dark/45">
                      Click a word and then a slot, or click a filled slot to remove it.
                    </p>
                  </div>
                  <span className="font-body text-xs text-pencil/45 dark:text-pencil-dark/45">
                    {unassignedWordBankEntries.length} remaining
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {unassignedWordBankEntries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setSelectedBankWordId((current) => (current === entry.id ? null : entry.id))}
                      className={`border-2 px-3 py-1.5 font-body text-base transition-all ${
                        selectedBankWordId === entry.id
                          ? 'bg-pen text-white scale-105'
                          : 'bg-white dark:bg-paper-dark hover:bg-postit dark:border-pencil-dark'
                      }`}
                      style={{ borderRadius: wobbly }}
                    >
                      {entry.word}
                    </button>
                  ))}
                  {unassignedWordBankEntries.length === 0 && (
                    <span className="font-body text-sm text-pencil/40 italic py-1">All words are placed.</span>
                  )}
                </div>
              </div>

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
                    <button
                      type="button"
                      onClick={() => handleDropTargetClick(entry.id)}
                      className={`min-w-[160px] min-h-[42px] border-2 border-dashed px-3 py-1 font-heading text-lg text-pencil dark:text-pencil-dark flex items-center cursor-pointer transition-colors ${
                        selectedBankWordId && !matchedEntry
                          ? 'border-pen/50 bg-blue-50/50 dark:bg-blue-900/10'
                          : matchedEntry
                            ? 'bg-postit/50 border-pencil/30'
                            : 'bg-erased/30 border-pencil/30'
                      }`}
                      style={{ borderRadius: wobbly }}
                    >
                      {matchedEntry ? matchedEntry.word : <span className="text-sm text-pencil/30">{selectedBankWordId ? 'Click to place' : 'Select a word'}</span>}
                    </button>
                    <span className="font-body text-lg text-pen dark:text-blue-300 flex-1">{entry.translation}</span>
                    {isCorrect && <Check size={18} className="text-green-600" />}
                    {isWrong && <X size={18} className="text-marker" />}
                  </div>
                )
              })}

              {!submitted && (
                <button
                  onClick={checkWordBankAnswers}
                  className="mt-4 flex items-center gap-2 font-body text-base px-6 py-2 border-2 border-pencil dark:border-pencil-dark bg-postit hover:bg-marker hover:text-white transition-colors mx-auto active:scale-[0.96] touch-target"
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
                      className={`border-2 px-4 py-4 text-left transition-all active:scale-[0.96] touch-target ${
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
            const isCorrect = submitted && normalizeAnswer(builtValue) === normalizeAnswer(entry.word)
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
                  <span className="font-heading text-xl text-pencil dark:text-pencil-dark tracking-wide">{builtValue || 'Build the word'}</span>
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
                        className={`min-w-[44px] min-h-[44px] border-2 px-3 py-2 font-heading text-lg transition-colors active:scale-[0.9] ${
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

function getExerciseTitle(type: ExerciseType) {
  switch (type) {
    case 'flashcards':
      return 'Flashcard Review'
    case 'fortune-wheel':
      return 'Fortune Wheel'
    case 'fill-blanks':
      return 'Fill in the Blanks'
    case 'type-in':
      return 'Type Translation'
    case 'reverse-type-in':
      return 'Type the Word'
    case 'multiple-choice':
      return 'Multiple Choice'
    case 'context-clues':
      return 'Context Clues'
    case 'word-bank':
      return 'Word Bank'
    case 'match-pairs':
      return 'Match Pairs'
    case 'scramble':
      return 'Word Scramble'
  }
}

function getCorrectCount(
  exerciseType: ExerciseType,
  shuffledEntries: VocabularyEntry[],
  answers: Record<string, string>,
) {
  if (exerciseType === 'context-clues') {
    return shuffledEntries.filter((entry) => answers[entry.id] === entry.word).length
  }

  if (exerciseType === 'word-bank') {
    return shuffledEntries.filter((entry) => answers[entry.id] === entry.id).length
  }

  if (exerciseType === 'reverse-type-in' || exerciseType === 'scramble') {
    return shuffledEntries.filter((entry) => normalizeAnswer(answers[entry.id]) === normalizeAnswer(entry.word)).length
  }

  if (exerciseType === 'multiple-choice') {
    return shuffledEntries.filter((entry) => answers[entry.id] === entry.translation).length
  }

  return shuffledEntries.filter((entry) => normalizeAnswer(answers[entry.id]) === normalizeAnswer(entry.translation)).length
}

function normalizeAnswer(value?: string) {
  return (value || '').toLowerCase().trim()
}

function getTranslationHint(translation: string) {
  return translation.length <= 2 ? `${translation.charAt(0)}_` : `${translation.slice(0, 2)}${'_'.repeat(Math.max(1, translation.length - 2))}`
}

function getWordHint(word: string) {
  return word.length <= 2 ? `${word.charAt(0)}_` : `${word.charAt(0)}${'_'.repeat(Math.max(1, word.length - 1))}`
}

function generateDistractors(entry: VocabularyEntry, allEntries: VocabularyEntry[]) {
  const others = allEntries.filter((item) => item.id !== entry.id).map((item) => item.translation)
  const shuffled = shuffleArray(others).slice(0, 3)
  const options = shuffleArray([...shuffled, entry.translation])
  while (options.length < 4) options.push('—')
  return options
}

function generateWordOptions(entry: VocabularyEntry, allEntries: VocabularyEntry[]) {
  const others = allEntries.filter((item) => item.id !== entry.id).map((item) => item.word)
  const shuffled = shuffleArray(others).slice(0, 3)
  const options = shuffleArray([...shuffled, entry.word])
  while (options.length < 4) options.push('—')
  return options
}

function createMatchCards(entries: VocabularyEntry[]) {
  return shuffleArray(
    entries.flatMap((entry) => [
      { id: `${entry.id}:word`, pairId: entry.id, value: entry.word, side: 'word' as const },
      { id: `${entry.id}:translation`, pairId: entry.id, value: entry.translation, side: 'translation' as const },
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getExerciseMinimumCount(type: ExerciseType) {
  if (type === 'match-pairs' || type === 'multiple-choice' || type === 'context-clues') return 2
  return 1
}

function pickFortuneWheelEntry(entries: VocabularyEntry[], weightedByWeakness: boolean) {
  if (!weightedByWeakness) {
    return entries[Math.floor(Math.random() * entries.length)]
  }

  const weights = entries.map((entry) => {
    const dueWeight = entry.srs.dueAt <= Date.now() ? 18 : 0
    const weaknessWeight = 110 - entry.strengthScore
    const mistakeWeight = entry.mistakeCount * 10
    const difficultyWeight = Math.max(6, Math.round(entry.difficultyScore * 0.45))
    return Math.max(1, dueWeight + weaknessWeight + mistakeWeight + difficultyWeight)
  })

  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let cursor = Math.random() * total

  for (let index = 0; index < entries.length; index += 1) {
    cursor -= weights[index]
    if (cursor <= 0) return entries[index]
  }

  return entries[entries.length - 1]
}

function buildWheelGradient(segmentCount: number) {
  if (segmentCount <= 0) {
    return 'linear-gradient(135deg, rgba(168,216,234,0.8), rgba(255,243,163,0.9))'
  }

  const colors = ['#a8d8ea', '#fff3a3', '#ffd6a5', '#c7f9cc', '#f8c4d8', '#d8c4ff', '#ffcf99', '#cde7be']
  const segmentSize = 360 / segmentCount
  const stops = Array.from({ length: segmentCount }, (_, index) => {
    const start = (index * segmentSize).toFixed(2)
    const end = ((index + 1) * segmentSize).toFixed(2)
    return `${colors[index % colors.length]} ${start}deg ${end}deg`
  })

  return `conic-gradient(${stops.join(', ')})`
}

function speak(value: string) {
  const utterance = new SpeechSynthesisUtterance(value)
  speechSynthesis.speak(utterance)
}

function FortuneToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`rounded-[18px] border px-3 py-3 text-left transition-colors ${
        checked
          ? 'border-pencil bg-postit/70 dark:border-pencil-dark dark:bg-erased-dark/80'
          : 'border-pencil/15 bg-paper/70 dark:border-pencil-dark/15 dark:bg-paper-dark/70'
      }`}
    >
      <div className="font-body text-sm text-pencil dark:text-pencil-dark">{label}</div>
      <div className="mt-1 font-body text-xs text-pencil/55 dark:text-pencil-dark/55">{hint}</div>
    </button>
  )
}

function ChoiceExerciseCard({
  index,
  title,
  subtitle,
  options,
  selected,
  correctValue,
  onSelect,
  showContext,
}: {
  index: number
  title: string
  subtitle: string | null
  options: string[]
  selected?: string
  correctValue: string
  onSelect: (value: string) => void
  showContext?: string | null
}) {
  const isAnswered = selected !== undefined

  return (
    <div className="bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark p-4" style={{ borderRadius: wobblyMd }}>
      <div className="flex items-start gap-2 mb-3">
        <span className="font-heading text-sm text-pencil/40 mt-0.5">{index + 1}.</span>
        <div>
          <span className="font-heading text-xl text-pencil dark:text-pencil-dark">{title}</span>
          {subtitle && <p className="font-body text-xs text-pencil/40 italic mt-1">{subtitle}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {options.map((option, optionIndex) => {
          const isSelected = selected === option
          const isCorrectOption = option === correctValue
          let style = 'bg-white dark:bg-paper-dark border-pencil/30 hover:bg-erased dark:hover:bg-erased-dark'

          if (isAnswered) {
            if (isCorrectOption) style = 'bg-green-100 border-green-500 text-green-800 dark:bg-green-900/30 dark:text-green-300'
            else if (isSelected) style = 'bg-red-100 border-marker text-red-800 dark:bg-red-900/30 dark:text-red-300'
          } else if (isSelected) {
            style = 'bg-postit border-pencil'
          }

          return (
            <button
              key={`${title}-${optionIndex}`}
              onClick={() => !isAnswered && onSelect(option)}
              className={`font-body text-base px-4 py-3 border-2 transition-colors text-left active:scale-[0.97] touch-target ${style}`}
              style={{ borderRadius: wobbly }}
              disabled={isAnswered}
            >
              {String.fromCharCode(65 + optionIndex)}. {option}
            </button>
          )
        })}
      </div>

      {showContext && (
        <p className="mt-2 font-body text-xs text-pencil/50 italic border-l-2 border-dashed border-pencil/20 pl-2">
          &ldquo;{showContext}&rdquo;
        </p>
      )}
    </div>
  )
}

function TypeExerciseRow({
  index,
  prompt,
  value,
  placeholder,
  hint,
  contextSentence,
  isCorrect,
  isWrong,
  answerLabel,
  onChange,
  onHint,
  disabled,
}: {
  index: number
  prompt: string
  value: string
  placeholder: string
  hint: string | null
  contextSentence: string
  isCorrect: boolean
  isWrong: boolean
  answerLabel: string | null
  onChange: (value: string) => void
  onHint: () => void
  disabled: boolean
}) {
  return (
    <div
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
        <span className="font-heading text-xl text-pencil dark:text-pencil-dark">{prompt}</span>
        {hint && <span className="ml-2 font-body text-sm text-pencil/40 italic">hint: {hint}</span>}
        {contextSentence && <p className="font-body text-xs text-pencil/40 italic mt-0.5 truncate">&ldquo;{contextSentence}&rdquo;</p>}
      </div>
      <span className="text-pencil/30">=</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-40 md:w-56 font-body text-base bg-transparent border-b-2 border-dashed border-pencil/30 outline-none text-pen dark:text-blue-300 px-2 py-1"
      />
      {!disabled && !hint && (
        <button onClick={onHint} className="p-1 text-pencil/25 hover:text-yellow-500 transition-colors flex-shrink-0" title="Show hint">
          <Lightbulb size={16} strokeWidth={2} />
        </button>
      )}
      {isCorrect && <Check size={18} className="text-green-600 flex-shrink-0" />}
      {isWrong && answerLabel && <span className="font-body text-sm text-marker flex-shrink-0 whitespace-nowrap">{answerLabel}</span>}
    </div>
  )
}
