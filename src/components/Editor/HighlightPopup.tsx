import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { Plus, Loader2, Check, X, ThumbsUp, ThumbsDown, Eye, Pencil } from 'lucide-react'
import { translateWord } from '../../services/translation'
import { useVocabularyStore } from '../../stores/vocabularyStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { wobbly } from '../../lib/utils'

interface HighlightPopupProps {
  word: string
  sentence: string
  editorRelTop: number
  editorRelBottom: number
  editorRelLeft: number
  documentId: string
  positionInDoc: number
  onDone: () => void
  editor: Editor | null
}

export function HighlightPopup({
  word,
  sentence,
  editorRelTop,
  editorRelBottom,
  editorRelLeft,
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
  const revealTranslation = useSettingsStore((s) => s.settings.revealTranslation)
  const highlightColor = useSettingsStore((s) => s.settings.highlightColor)

  const [translation, setTranslation] = useState('')
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState(false)
  const [translationAccepted, setTranslationAccepted] = useState(false)
  const [translationSource, setTranslationSource] = useState<string>('')
  const [revealed, setRevealed] = useState(!revealTranslation)
  const [editingWord, setEditingWord] = useState(false)
  const [editedWord, setEditedWord] = useState(word)
  const [popupPosition, setPopupPosition] = useState({ top: 8, left: 8, pointerLeft: 150, placement: 'top' as 'top' | 'bottom' })
  const popupRef = useRef<HTMLDivElement>(null)

  // Auto-translate on open
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setAdded(false)
    setTranslationAccepted(false)
    setRevealed(!revealTranslation)
    setEditedWord(word)
    setEditingWord(false)
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
  }, [word, translateFrom, translateTo, autoAccept, revealTranslation])

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

  useLayoutEffect(() => {
    const popupEl = popupRef.current
    const containerEl = popupEl?.offsetParent as HTMLElement | null
    if (!popupEl) return

    const width = popupEl.offsetWidth || 300
    const height = popupEl.offsetHeight || 196
    const containerWidth = containerEl?.clientWidth ?? window.innerWidth
    const visibleTop = containerEl?.scrollTop ?? 0
    const visibleBottom = visibleTop + (containerEl?.clientHeight ?? window.innerHeight)
    const unclampedLeft = editorRelLeft - width / 2
    const left = Math.min(Math.max(8, unclampedLeft), Math.max(8, containerWidth - width - 8))
    const preferredTop = editorRelTop - height - 18
    const canPlaceAbove = preferredTop >= visibleTop + 8
    const canPlaceBelow = editorRelBottom + height + 18 <= visibleBottom - 8
    const placement = !canPlaceAbove && canPlaceBelow ? 'bottom' : 'top'
    const top = placement === 'bottom'
      ? Math.min(editorRelBottom + 18, Math.max(8, visibleBottom - height - 8))
      : Math.max(8, preferredTop)
    const pointerLeft = Math.min(width - 18, Math.max(18, editorRelLeft - left))

    setPopupPosition({ top, left, pointerLeft, placement })
  }, [editorRelBottom, editorRelLeft, editorRelTop, translation, loading, revealed, editingWord, editedWord, sentence, requireConfirmation, translationAccepted, word])

  const handleAdd = () => {
    const wordToAdd = editedWord.trim() || word
    if (hasDuplicate(wordToAdd, documentId)) {
      notify('This word is already in your vocabulary!', 'info')
      onDone()
      return
    }

    if (editor) {
      editor.chain().focus().setHighlight({ color: highlightColor }).run()
    }

    addEntry({
      word: wordToAdd,
      translation,
      contextSentence: sentence,
      notes: '',
      tags: [],
      positionInDoc,
      documentId,
    })

    notify(`"${wordToAdd}" added to vocabulary!`)
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
      className="absolute z-50 animate-pop-in"
      style={{
        top: `${popupPosition.top}px`,
        left: `${popupPosition.left}px`,
        width: '300px',
        maxWidth: 'calc(100% - 16px)',
      }}
    >
      <div
        className="bg-white dark:bg-paper-dark border-[3px] border-pencil dark:border-pencil-dark px-4 py-3 shadow-hard dark:shadow-hard-dark"
        style={{ borderRadius: wobbly }}
      >
        {/* Word header — editable */}
        <div className="flex items-center justify-between mb-1">
          {editingWord ? (
            <input
              type="text"
              value={editedWord}
              onChange={(e) => setEditedWord(e.target.value)}
              onBlur={() => setEditingWord(false)}
              onKeyDown={(e) => { if (e.key === 'Enter') setEditingWord(false) }}
              className="font-heading text-lg text-pencil dark:text-pencil-dark font-bold bg-transparent border-b-2 border-pen outline-none flex-1 mr-2"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <p className="font-heading text-lg text-pencil dark:text-pencil-dark font-bold truncate">
                {editedWord}
              </p>
              <button
                onClick={() => setEditingWord(true)}
                className="text-pencil/30 hover:text-pencil dark:hover:text-pencil-dark flex-shrink-0 transition-colors"
                title="Edit word (e.g. change to infinitive)"
              >
                <Pencil size={12} strokeWidth={2.5} />
              </button>
            </div>
          )}
          <button onClick={onDone} className="text-pencil/40 hover:text-marker flex-shrink-0 ml-1">
            <X size={14} strokeWidth={3} />
          </button>
        </div>

        {/* Original selection reference (if edited) */}
        {editedWord !== word && (
          <p className="font-body text-xs text-pencil/35 dark:text-pencil-dark/35 mb-1">
            selected: &ldquo;{word}&rdquo;
          </p>
        )}

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
        ) : !revealed ? (
          /* Click-to-reveal button */
          <button
            onClick={() => setRevealed(true)}
            className="w-full flex items-center justify-center gap-2 font-body text-sm text-pencil/50 dark:text-pencil-dark/50 border-2 border-dashed border-pencil/20 dark:border-pencil-dark/20 py-2 mb-2 hover:bg-erased/50 dark:hover:bg-erased-dark/50 transition-colors"
            style={{ borderRadius: wobbly }}
          >
            <Eye size={14} strokeWidth={2.5} />
            Tap to reveal translation
          </button>
        ) : (
          <div className="mb-2 animate-slide-in-up">
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
          disabled={loading || added || !revealed}
          className={`w-full flex items-center justify-center gap-2 font-body text-base px-3 py-1.5 border-2 border-pencil dark:border-pencil-dark transition-all duration-100
            ${added
              ? 'bg-green-500 text-white'
              : 'bg-postit text-pencil hover:bg-marker hover:text-white hover:translate-x-[1px] hover:translate-y-[1px]'
            } disabled:opacity-40`}
          style={{ borderRadius: wobbly }}
        >
          {added ? (
            <><Check size={16} strokeWidth={3} /> Added!</>
          ) : (
            <><Plus size={16} strokeWidth={3} /> Add to Vocabulary</>
          )}
        </button>
      </div>

      {/* Triangle pointer (points down toward the word) */}
      <div
        className="absolute -translate-x-1/2 w-0 h-0"
        style={{
          left: `${popupPosition.pointerLeft}px`,
          bottom: popupPosition.placement === 'top' ? '-10px' : 'auto',
          top: popupPosition.placement === 'bottom' ? '-10px' : 'auto',
          borderLeft: '10px solid transparent',
          borderRight: '10px solid transparent',
          borderTop: popupPosition.placement === 'top' ? '10px solid #2d2d2d' : '0 solid transparent',
          borderBottom: popupPosition.placement === 'bottom' ? '10px solid #2d2d2d' : '0 solid transparent',
        }}
      />
    </div>
  )
}
