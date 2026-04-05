import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { Plus, Loader2, Check, X, ThumbsUp, ThumbsDown } from 'lucide-react'
import { translateWord } from '../../services/translation'
import { useVocabularyStore } from '../../stores/vocabularyStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { wobbly } from '../../lib/utils'

interface HighlightPopupProps {
  word: string
  sentence: string
  rect: DOMRect
  documentId: string
  positionInDoc: number
  onDone: () => void
  editor: Editor | null
}

export function HighlightPopup({
  word,
  sentence,
  rect,
  documentId,
  positionInDoc,
  onDone,
  editor,
}: HighlightPopupProps) {
  const addEntry = useVocabularyStore((s) => s.addEntry)
  const hasDuplicate = useVocabularyStore((s) => s.hasDuplicate)
  const notify = useSettingsStore((s) => s.notify)
  const translateTo = useSettingsStore((s) => s.settings.translateTo)
  const translateFrom = useSettingsStore((s) => s.settings.translateFrom)
  const autoAccept = useSettingsStore((s) => s.settings.autoAcceptTranslation)
  const requireConfirmation = useSettingsStore((s) => s.settings.requireConfirmation)

  const [translation, setTranslation] = useState('')
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState(false)
  const [translationAccepted, setTranslationAccepted] = useState(false)
  const [translationSource, setTranslationSource] = useState<string>('')
  const [pos, setPos] = useState({ top: 0, left: 0, below: false })
  const popupRef = useRef<HTMLDivElement>(null)

  // Auto-translate on open
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setAdded(false)
    setTranslationAccepted(false)
    translateWord(word, translateFrom, translateTo).then((result) => {
      if (!cancelled) {
        setTranslation(result.translation)
        setTranslationSource(result.source)
        setLoading(false)
        if (autoAccept && result.translation) {
          setTranslationAccepted(true)
        }
      }
    })
    return () => { cancelled = true }
  }, [word, translateFrom, translateTo, autoAccept])

  // Calculate position relative to viewport, clamped to screen
  useLayoutEffect(() => {
    const popupEl = popupRef.current
    const pad = 12
    const popupH = popupEl?.offsetHeight ?? 120
    const popupW = popupEl?.offsetWidth ?? 260

    let top = rect.top - popupH - 22
    let below = false

    // If popup would go above viewport, show below selection
    if (top < pad) {
      top = rect.bottom + 22
      below = true
    }

    let left = rect.left + rect.width / 2 - popupW / 2
    // Clamp horizontally
    left = Math.max(pad, Math.min(left, window.innerWidth - popupW - pad))

    setPos({ top, left, below })
  }, [rect])

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onDone()
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDone()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onDone])

  const handleAdd = () => {
    if (hasDuplicate(word, documentId)) {
      notify('This word is already in your vocabulary!', 'info')
      onDone()
      return
    }

    if (editor) {
      editor.chain().focus().toggleHighlight().run()
    }

    addEntry({
      word,
      translation,
      contextSentence: sentence,
      notes: '',
      tags: [],
      positionInDoc,
      documentId,
    })

    notify(`"${word}" added to vocabulary!`)
    setAdded(true)
    setTimeout(onDone, 500)
  }

  const handleReject = () => {
    setTranslation('')
    setTranslationAccepted(false)
  }

  return (
    <div
      ref={popupRef}
      className="fixed z-50 animate-pop-in"
      style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
    >
      <div
        className="bg-white dark:bg-paper-dark border-[3px] border-pencil dark:border-pencil-dark px-4 py-3 shadow-hard dark:shadow-hard-dark min-w-[250px] max-w-[350px]"
        style={{ borderRadius: wobbly }}
      >
        {/* Word header */}
        <div className="flex items-center justify-between mb-1">
          <p className="font-heading text-lg text-pencil dark:text-pencil-dark font-bold">
            {word}
          </p>
          <button onClick={onDone} className="text-pencil/40 hover:text-marker">
            <X size={14} strokeWidth={3} />
          </button>
        </div>

        {/* Context sentence */}
        {sentence && (
          <p className="font-body text-xs text-pencil/50 dark:text-pencil-dark/50 italic mb-2 leading-relaxed border-l-2 border-dashed border-pencil/20 pl-2">
            {sentence.split(word).map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && <strong className="text-pencil dark:text-pencil-dark not-italic">{word}</strong>}
              </span>
            ))}
          </p>
        )}

        {/* Translation area */}
        {loading ? (
          <div className="flex items-center gap-2 text-pencil/60 dark:text-pencil-dark/60 font-body mb-2">
            <Loader2 size={14} className="animate-spin" />
            Translating...
          </div>
        ) : (
          <div className="mb-2">
            <input
              type="text"
              value={translation}
              onChange={(e) => { setTranslation(e.target.value); setTranslationAccepted(true) }}
              className="w-full font-body text-base bg-transparent border-b-2 border-dashed border-pencil/30 dark:border-pencil-dark/30 outline-none text-pen dark:text-blue-300 pb-1"
              placeholder="Translation..."
              autoFocus
            />
            {/* Accept/Reject buttons for auto-translation */}
            {translationSource && translation && !translationAccepted && requireConfirmation && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="font-body text-xs text-pencil/40 flex-1">
                  via {translationSource}
                </span>
                <button
                  onClick={() => setTranslationAccepted(true)}
                  className="flex items-center gap-1 text-xs font-body text-green-600 hover:text-green-700 border border-green-600/30 px-2 py-0.5 rounded"
                  title="Accept translation"
                >
                  <ThumbsUp size={12} strokeWidth={2.5} /> Accept
                </button>
                <button
                  onClick={handleReject}
                  className="flex items-center gap-1 text-xs font-body text-marker hover:text-red-700 border border-marker/30 px-2 py-0.5 rounded"
                  title="Reject translation"
                >
                  <ThumbsDown size={12} strokeWidth={2.5} /> Reject
                </button>
              </div>
            )}
          </div>
        )}

        {/* Add button */}
        <button
          onClick={handleAdd}
          disabled={loading || added}
          className={`w-full flex items-center justify-center gap-2 font-body text-base px-3 py-1.5 border-2 border-pencil dark:border-pencil-dark transition-all duration-100
            ${added
              ? 'bg-green-500 text-white'
              : 'bg-postit text-pencil hover:bg-marker hover:text-white hover:translate-x-[1px] hover:translate-y-[1px]'
            }`}
          style={{ borderRadius: wobbly }}
        >
          {added ? (
            <><Check size={16} strokeWidth={3} /> Added!</>
          ) : (
            <><Plus size={16} strokeWidth={3} /> Add to Vocabulary</>
          )}
        </button>
      </div>

      {/* Triangle pointer */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
        style={pos.below ? {
          top: '-10px',
          borderLeft: '10px solid transparent',
          borderRight: '10px solid transparent',
          borderBottom: '10px solid #2d2d2d',
        } : {
          bottom: '-10px',
          borderLeft: '10px solid transparent',
          borderRight: '10px solid transparent',
          borderTop: '10px solid #2d2d2d',
        }}
      />
    </div>
  )
}
