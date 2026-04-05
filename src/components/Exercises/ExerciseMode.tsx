import { useState, useMemo, useCallback } from 'react'
import { X, ArrowLeft, Check, RotateCcw, Printer, Eye, EyeOff, Shuffle } from 'lucide-react'
import { useVocabularyStore } from '../../stores/vocabularyStore'
import { useDocumentStore } from '../../stores/documentStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { wobbly, wobblyMd } from '../../lib/utils'
import type { VocabularyEntry } from '../../types'

type ExerciseType = 'fill-blanks' | 'type-in' | 'multiple-choice' | 'word-bank'

interface ExerciseProps {
  onClose: () => void
}

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
  const [draggedWord, setDraggedWord] = useState<string | null>(null)

  const filteredEntries = useMemo(() => {
    let result = entries
    if (docFilter) result = result.filter((e) => e.documentId === docFilter)
    return result.length > 0 ? result : entries
  }, [entries, docFilter])

  const shuffleAndStart = useCallback((type: ExerciseType) => {
    const shuffled = [...filteredEntries].sort(() => Math.random() - 0.5)
    setShuffledEntries(shuffled)
    setExerciseType(type)
    setUserAnswers({})
    setSubmitted(false)
    setShowAnswers(false)
  }, [filteredEntries])

  const checkAnswers = () => {
    setSubmitted(true)
    const correct = shuffledEntries.filter((e) =>
      userAnswers[e.id]?.toLowerCase().trim() === e.translation.toLowerCase().trim()
    ).length
    notify(`${correct} / ${shuffledEntries.length} correct!`)
  }

  const getScore = () => {
    if (!submitted) return null
    const correct = shuffledEntries.filter((e) =>
      userAnswers[e.id]?.toLowerCase().trim() === e.translation.toLowerCase().trim()
    ).length
    return { correct, total: shuffledEntries.length }
  }

  const generateDistractors = (entry: VocabularyEntry): string[] => {
    const others = entries.filter((e) => e.id !== entry.id).map((e) => e.translation)
    const shuffled = others.sort(() => Math.random() - 0.5).slice(0, 3)
    // Add correct answer and shuffle
    const options = [...shuffled, entry.translation].sort(() => Math.random() - 0.5)
    if (options.length < 4) {
      while (options.length < 4) options.push('—')
    }
    return options
  }

  // Memoize multiple choice options
  const mcOptions = useMemo(() => {
    if (exerciseType !== 'multiple-choice') return new Map()
    const map = new Map<string, string[]>()
    shuffledEntries.forEach((e) => map.set(e.id, generateDistractors(e)))
    return map
  }, [exerciseType, shuffledEntries])

  const score = getScore()

  // Exercise selection screen
  if (!exerciseType) {
    return (
      <div className="fixed inset-0 z-50 bg-paper dark:bg-paper-dark flex flex-col overflow-hidden animate-pop-in">
        <div className="flex items-center gap-4 p-4 border-b-2 border-dashed border-pencil/20 dark:border-pencil-dark/20">
          <button onClick={onClose} className="flex items-center gap-1 font-body text-sm text-pencil/60 hover:text-pencil">
            <ArrowLeft size={18} strokeWidth={2.5} /> Back
          </button>
          <h1 className="font-heading text-3xl text-pencil dark:text-pencil-dark" style={{ transform: 'rotate(-1deg)' }}>
            🎯 Exercises
          </h1>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full space-y-6">
            <div className="mb-6">
              <label className="font-body text-sm text-pencil/60 mb-2 block">Practice words from:</label>
              <select
                value={docFilter}
                onChange={(e) => setDocFilter(e.target.value)}
                className="font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-3 py-2 outline-none w-full max-w-sm"
                style={{ borderRadius: wobbly }}
              >
                <option value="">All documents ({entries.length} words)</option>
                {documents.map((d) => {
                  const count = entries.filter((e) => e.documentId === d.id).length
                  return count > 0 ? (
                    <option key={d.id} value={d.id}>{d.title || 'Untitled'} ({count} words)</option>
                  ) : null
                })}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {([
                { type: 'fill-blanks' as const, title: '📝 Fill in the Blanks', desc: 'Words are hidden in context sentences. Read and fill them in.' },
                { type: 'type-in' as const, title: '⌨️ Type Translation', desc: 'See the word and type its translation. Check your answers.' },
                { type: 'multiple-choice' as const, title: '🔘 Multiple Choice', desc: 'Choose the correct translation from 4 options.' },
                { type: 'word-bank' as const, title: '🧩 Word Bank', desc: 'Drag words from a bank to match with their translations.' },
              ]).map(({ type, title, desc }) => (
                <button
                  key={type}
                  onClick={() => shuffleAndStart(type)}
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

  // Exercise execution screen
  return (
    <div className="fixed inset-0 z-50 bg-paper dark:bg-paper-dark flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b-2 border-dashed border-pencil/20 dark:border-pencil-dark/20">
        <button onClick={() => setExerciseType(null)} className="flex items-center gap-1 font-body text-sm text-pencil/60 hover:text-pencil">
          <ArrowLeft size={18} strokeWidth={2.5} /> Back
        </button>
        <h2 className="font-heading text-2xl text-pencil dark:text-pencil-dark">
          {exerciseType === 'fill-blanks' && '📝 Fill in the Blanks'}
          {exerciseType === 'type-in' && '⌨️ Type Translation'}
          {exerciseType === 'multiple-choice' && '🔘 Multiple Choice'}
          {exerciseType === 'word-bank' && '🧩 Word Bank'}
        </h2>

        <div className="ml-auto flex items-center gap-3">
          {score && (
            <span className="font-heading text-xl text-pen">
              {score.correct}/{score.total} ✓
            </span>
          )}
          <button
            onClick={() => shuffleAndStart(exerciseType)}
            className="flex items-center gap-1 font-body text-sm px-3 py-1.5 border-2 border-pencil dark:border-pencil-dark bg-white dark:bg-paper-dark hover:bg-erased transition-colors"
            style={{ borderRadius: wobbly }}
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            onClick={() => setShowAnswers(!showAnswers)}
            className="flex items-center gap-1 font-body text-sm px-3 py-1.5 border-2 border-pencil dark:border-pencil-dark bg-white dark:bg-paper-dark hover:bg-erased transition-colors"
            style={{ borderRadius: wobbly }}
          >
            {showAnswers ? <EyeOff size={14} /> : <Eye size={14} />}
            {showAnswers ? 'Hide' : 'Show'} Answers
          </button>
          {!submitted && exerciseType !== 'fill-blanks' && (
            <button
              onClick={checkAnswers}
              className="flex items-center gap-1 font-body text-sm px-4 py-1.5 border-2 border-pencil dark:border-pencil-dark bg-postit hover:bg-marker hover:text-white transition-colors"
              style={{ borderRadius: wobbly }}
            >
              <Check size={14} /> Check
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

      {/* Exercise content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">

          {/* FILL IN THE BLANKS */}
          {exerciseType === 'fill-blanks' && shuffledEntries.map((entry, i) => (
            <div
              key={entry.id}
              className="bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark p-4"
              style={{ borderRadius: wobblyMd }}
            >
              <span className="font-heading text-sm text-pencil/40 mr-2">{i + 1}.</span>
              <span className="font-body text-base text-pencil dark:text-pencil-dark">
                {entry.contextSentence ? (
                  entry.contextSentence.split(new RegExp(`(${entry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, j) =>
                    part.toLowerCase() === entry.word.toLowerCase() ? (
                      <span key={j} className={`inline-block min-w-[80px] border-b-2 border-dashed border-pencil/40 mx-1 text-center ${showAnswers ? 'text-pen font-bold' : 'text-transparent'}`}>
                        {showAnswers ? entry.word : '________'}
                      </span>
                    ) : <span key={j}>{part}</span>
                  )
                ) : (
                  <>
                    <span className={`inline-block min-w-[80px] border-b-2 border-dashed border-pencil/40 mx-1 text-center ${showAnswers ? 'text-pen font-bold' : 'text-transparent'}`}>
                      {showAnswers ? entry.word : '________'}
                    </span>
                    <span className="text-pencil/50 ml-2">({entry.translation})</span>
                  </>
                )}
              </span>
            </div>
          ))}

          {/* TYPE IN */}
          {exerciseType === 'type-in' && shuffledEntries.map((entry, i) => {
            const isCorrect = submitted && userAnswers[entry.id]?.toLowerCase().trim() === entry.translation.toLowerCase().trim()
            const isWrong = submitted && !isCorrect
            return (
              <div
                key={entry.id}
                className={`bg-white dark:bg-paper-dark border-2 p-4 flex items-center gap-4 ${
                  isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
                  isWrong ? 'border-marker bg-red-50 dark:bg-red-900/20' :
                  'border-pencil dark:border-pencil-dark'
                }`}
                style={{ borderRadius: wobblyMd }}
              >
                <span className="font-heading text-sm text-pencil/40 w-6">{i + 1}.</span>
                <span className="font-heading text-xl text-pencil dark:text-pencil-dark min-w-[120px]">{entry.word}</span>
                <span className="text-pencil/30">=</span>
                <input
                  type="text"
                  value={userAnswers[entry.id] || ''}
                  onChange={(e) => setUserAnswers({ ...userAnswers, [entry.id]: e.target.value })}
                  disabled={submitted}
                  placeholder="Type translation..."
                  className="flex-1 font-body text-base bg-transparent border-b-2 border-dashed border-pencil/30 outline-none text-pen dark:text-blue-300 px-2 py-1"
                />
                {isCorrect && <Check size={18} className="text-green-600" />}
                {isWrong && (
                  <span className="font-body text-sm text-marker">
                    → {entry.translation}
                  </span>
                )}
              </div>
            )
          })}

          {/* MULTIPLE CHOICE */}
          {exerciseType === 'multiple-choice' && shuffledEntries.map((entry, i) => {
            const options = mcOptions.get(entry.id) || []
            const selected = userAnswers[entry.id]
            const isCorrect = submitted && selected === entry.translation
            return (
              <div
                key={entry.id}
                className="bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark p-4"
                style={{ borderRadius: wobblyMd }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-heading text-sm text-pencil/40">{i + 1}.</span>
                  <span className="font-heading text-xl text-pencil dark:text-pencil-dark">{entry.word}</span>
                  {entry.contextSentence && (
                    <span className="font-body text-xs text-pencil/40 italic ml-2">
                      &ldquo;...{entry.contextSentence.slice(0, 50)}...&rdquo;
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {options.map((opt: string, j: number) => {
                    const isSelected = selected === opt
                    const isCorrectOpt = opt === entry.translation
                    let style = 'bg-white dark:bg-paper-dark border-pencil/30 hover:bg-erased dark:hover:bg-erased-dark'
                    if (submitted) {
                      if (isCorrectOpt) style = 'bg-green-100 border-green-500 text-green-800'
                      else if (isSelected && !isCorrectOpt) style = 'bg-red-100 border-marker text-red-800'
                    } else if (isSelected) {
                      style = 'bg-postit border-pencil'
                    }
                    return (
                      <button
                        key={j}
                        onClick={() => !submitted && setUserAnswers({ ...userAnswers, [entry.id]: opt })}
                        className={`font-body text-base px-4 py-2 border-2 transition-colors text-left ${style}`}
                        style={{ borderRadius: wobbly }}
                        disabled={submitted}
                      >
                        {String.fromCharCode(65 + j)}. {opt}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* WORD BANK */}
          {exerciseType === 'word-bank' && (
            <>
              {/* Word bank */}
              <div
                className="bg-postit/50 dark:bg-erased-dark border-2 border-dashed border-pencil/30 p-4 mb-6"
                style={{ borderRadius: wobblyMd }}
              >
                <h3 className="font-heading text-sm text-pencil/60 mb-2">Word Bank (drag to match)</h3>
                <div className="flex flex-wrap gap-2">
                  {[...shuffledEntries]
                    .sort(() => Math.random() - 0.5)
                    .filter((e) => !Object.values(userAnswers).includes(e.word))
                    .map((entry) => (
                      <span
                        key={entry.id}
                        draggable
                        onDragStart={() => setDraggedWord(entry.word)}
                        className="px-3 py-1.5 font-body text-base bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark cursor-grab active:cursor-grabbing hover:bg-postit transition-colors"
                        style={{ borderRadius: wobbly }}
                      >
                        {entry.word}
                      </span>
                    ))}
                </div>
              </div>

              {/* Drop targets */}
              {shuffledEntries.map((entry, i) => {
                const matched = Object.entries(userAnswers).find(([_, v]) => v === entry.word)
                const isCorrect = submitted && matched && matched[0] === entry.id
                const isWrong = submitted && matched && matched[0] !== entry.id
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-4 bg-white dark:bg-paper-dark border-2 p-3 ${
                      isCorrect ? 'border-green-500' : isWrong ? 'border-marker' : 'border-pencil dark:border-pencil-dark'
                    }`}
                    style={{ borderRadius: wobblyMd }}
                  >
                    <span className="font-heading text-sm text-pencil/40 w-6">{i + 1}.</span>
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (draggedWord) {
                          // Remove word from any other slot
                          const newAnswers = { ...userAnswers }
                          Object.keys(newAnswers).forEach((k) => {
                            if (newAnswers[k] === draggedWord) delete newAnswers[k]
                          })
                          newAnswers[entry.id] = draggedWord
                          setUserAnswers(newAnswers)
                          setDraggedWord(null)
                        }
                      }}
                      className={`min-w-[120px] min-h-[36px] border-2 border-dashed border-pencil/30 px-3 py-1 font-heading text-lg text-pencil dark:text-pencil-dark flex items-center ${
                        userAnswers[entry.id] ? 'bg-postit/50' : 'bg-erased/30'
                      }`}
                      style={{ borderRadius: wobbly }}
                    >
                      {userAnswers[entry.id] || (
                        <span className="text-pencil/30 text-sm">Drop word here</span>
                      )}
                    </div>
                    <span className="text-pencil/30">=</span>
                    <span className="font-body text-lg text-pen dark:text-blue-300 flex-1">{entry.translation}</span>
                    {isCorrect && <Check size={18} className="text-green-600" />}
                    {isWrong && <X size={18} className="text-marker" />}
                  </div>
                )
              })}

              {/* Word bank check: compare entry.id with answer */}
              {!submitted && (
                <button
                  onClick={() => {
                    setSubmitted(true)
                    const correct = shuffledEntries.filter((e) => userAnswers[e.id] === e.word).length
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
        </div>
      </div>
    </div>
  )
}
