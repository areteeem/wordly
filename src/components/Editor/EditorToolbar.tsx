import type { Editor } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Highlighter,
  Undo,
  Redo,
  ImageIcon,
  Quote,
  Code,
  Minus,
  RemoveFormatting,
  Link2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Subscript,
  Superscript,
  Languages,
  Pin,
  X,
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'

const HIGHLIGHT_COLORS = ['#a8d8ea', '#fff3a3', '#ffd6a5', '#c7f9cc', '#f8c4d8', '#d8c4ff']

type ContinuousFormatKey =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'bullet-list'
  | 'ordered-list'
  | 'highlight'
  | 'blockquote'
  | 'code-block'
  | 'subscript'
  | 'superscript'
  | 'align-left'
  | 'align-center'
  | 'align-right'

interface ContinuousFormatConfig {
  label: string
  version: string
  apply: () => boolean
}

interface EditorToolbarProps {
  editor: Editor
}

function ToolbarButton({
  isActive,
  isLocked,
  onClick,
  onDoubleClick,
  children,
  title,
}: {
  isActive?: boolean
  isLocked?: boolean
  onClick: () => void
  onDoubleClick?: () => void
  children: React.ReactNode
  title: string
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        if (event.detail >= 2 && onDoubleClick) {
          onDoubleClick()
          return
        }

        onClick()
      }}
      title={title}
      className={`relative p-1.5 rounded transition-colors ${
        isActive
          ? 'bg-pencil text-white dark:bg-pencil-dark dark:text-paper-dark'
          : 'text-pencil dark:text-pencil-dark hover:bg-erased dark:hover:bg-erased-dark'
      } ${isLocked ? 'ring-2 ring-pen/60 ring-offset-1 ring-offset-white dark:ring-blue-300/70 dark:ring-offset-paper-dark' : ''}`}
    >
      {children}
      {isLocked && (
        <span className="absolute -right-1 -top-1 rounded-full bg-pen p-0.5 text-white shadow-sm dark:bg-blue-300 dark:text-paper-dark">
          <Pin size={9} strokeWidth={2.5} />
        </span>
      )}
    </button>
  )
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const highlightPopupEnabled = useSettingsStore((s) => s.settings.highlightPopupEnabled)
  const highlightColor = useSettingsStore((s) => s.settings.highlightColor)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const [showHighlightPalette, setShowHighlightPalette] = useState(false)
  const [lockedFormatKey, setLockedFormatKey] = useState<ContinuousFormatKey | null>(null)
  const highlightToolRef = useRef<HTMLDivElement>(null)
  const applyingContinuousFormatRef = useRef(false)
  const lastAppliedSelectionRef = useRef<string | null>(null)

  const continuousFormats: Record<ContinuousFormatKey, ContinuousFormatConfig> = {
    bold: {
      label: 'Bold',
      version: 'bold',
      apply: () => editor.chain().focus().setMark('bold').run(),
    },
    italic: {
      label: 'Italic',
      version: 'italic',
      apply: () => editor.chain().focus().setMark('italic').run(),
    },
    underline: {
      label: 'Underline',
      version: 'underline',
      apply: () => editor.chain().focus().setMark('underline').run(),
    },
    strike: {
      label: 'Strikethrough',
      version: 'strike',
      apply: () => editor.chain().focus().setMark('strike').run(),
    },
    'heading-1': {
      label: 'Heading 1',
      version: 'heading-1',
      apply: () => editor.isActive('heading', { level: 1 }) || editor.chain().focus().setHeading({ level: 1 }).run(),
    },
    'heading-2': {
      label: 'Heading 2',
      version: 'heading-2',
      apply: () => editor.isActive('heading', { level: 2 }) || editor.chain().focus().setHeading({ level: 2 }).run(),
    },
    'heading-3': {
      label: 'Heading 3',
      version: 'heading-3',
      apply: () => editor.isActive('heading', { level: 3 }) || editor.chain().focus().setHeading({ level: 3 }).run(),
    },
    'bullet-list': {
      label: 'Bullet List',
      version: 'bullet-list',
      apply: () => editor.isActive('bulletList') || editor.chain().focus().toggleBulletList().run(),
    },
    'ordered-list': {
      label: 'Numbered List',
      version: 'ordered-list',
      apply: () => editor.isActive('orderedList') || editor.chain().focus().toggleOrderedList().run(),
    },
    highlight: {
      label: 'Highlight',
      version: `highlight:${highlightColor}`,
      apply: () => editor.chain().focus().setHighlight({ color: highlightColor }).run(),
    },
    blockquote: {
      label: 'Blockquote',
      version: 'blockquote',
      apply: () => editor.isActive('blockquote') || editor.chain().focus().toggleBlockquote().run(),
    },
    'code-block': {
      label: 'Code Block',
      version: 'code-block',
      apply: () => editor.isActive('codeBlock') || editor.chain().focus().toggleCodeBlock().run(),
    },
    subscript: {
      label: 'Subscript',
      version: 'subscript',
      apply: () => editor.chain().focus().unsetMark('superscript').setMark('subscript').run(),
    },
    superscript: {
      label: 'Superscript',
      version: 'superscript',
      apply: () => editor.chain().focus().unsetMark('subscript').setMark('superscript').run(),
    },
    'align-left': {
      label: 'Align Left',
      version: 'align-left',
      apply: () => editor.isActive({ textAlign: 'left' }) || editor.chain().focus().setTextAlign('left').run(),
    },
    'align-center': {
      label: 'Align Center',
      version: 'align-center',
      apply: () => editor.isActive({ textAlign: 'center' }) || editor.chain().focus().setTextAlign('center').run(),
    },
    'align-right': {
      label: 'Align Right',
      version: 'align-right',
      apply: () => editor.isActive({ textAlign: 'right' }) || editor.chain().focus().setTextAlign('right').run(),
    },
  }

  const lockedFormat = lockedFormatKey ? continuousFormats[lockedFormatKey] : null

  useEffect(() => {
    if (!showHighlightPalette) return

    const handlePointerDown = (event: MouseEvent) => {
      if (highlightToolRef.current && !highlightToolRef.current.contains(event.target as Node)) {
        setShowHighlightPalette(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [showHighlightPalette])

  useEffect(() => {
    lastAppliedSelectionRef.current = null
  }, [lockedFormat?.version])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLockedFormatKey(null)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  useEffect(() => {
    if (!lockedFormat) return

    const applyContinuousFormat = () => {
      const { from, to, empty } = editor.state.selection
      if (empty || from === to || applyingContinuousFormatRef.current) {
        if (empty || from === to) {
          lastAppliedSelectionRef.current = null
        }
        return
      }

      const selectionSignature = `${lockedFormat.version}:${from}-${to}`
      if (lastAppliedSelectionRef.current === selectionSignature) return

      applyingContinuousFormatRef.current = true
      const didApply = lockedFormat.apply()
      applyingContinuousFormatRef.current = false

      if (didApply) {
        lastAppliedSelectionRef.current = selectionSignature
      }
    }

    const handleSelectionUpdate = () => {
      window.requestAnimationFrame(applyContinuousFormat)
    }

    editor.on('selectionUpdate', handleSelectionUpdate)
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate)
    }
  }, [editor, lockedFormat])

  const toggleLockedFormat = (key: ContinuousFormatKey) => {
    setLockedFormatKey((prev) => (prev === key ? null : key))
    if (key === 'highlight') {
      setShowHighlightPalette(true)
      return
    }

    setShowHighlightPalette(false)
  }

  const handleStandardButtonClick = (key: ContinuousFormatKey, action: () => void) => {
    if (lockedFormatKey === key) {
      setLockedFormatKey(null)
      return
    }

    setShowHighlightPalette(false)
    action()
  }

  const handleToggleHighlight = () => {
    if (lockedFormatKey === 'highlight') {
      setLockedFormatKey(null)
      setShowHighlightPalette(false)
      return
    }

    if (editor.state.selection.empty && editor.isActive('highlight')) {
      editor.chain().focus().unsetHighlight().run()
      setShowHighlightPalette(false)
      return
    }

    setShowHighlightPalette((prev) => !prev)
  }

  const handleHighlightColorChange = (color: string) => {
    updateSettings({ highlightColor: color })
    if (!editor.state.selection.empty) {
      editor.chain().focus().setHighlight({ color }).run()
    }
    setShowHighlightPalette(lockedFormatKey === 'highlight')
  }

  return (
    <div className="flex items-center gap-1 px-6 pb-2 flex-wrap">
      <ToolbarButton
        title="Bold. Click once to toggle, click again to lock continuous formatting."
        isActive={editor.isActive('bold') || lockedFormatKey === 'bold'}
        isLocked={lockedFormatKey === 'bold'}
        onClick={() => handleStandardButtonClick('bold', () => editor.chain().focus().toggleBold().run())}
        onDoubleClick={() => toggleLockedFormat('bold')}
      >
        <Bold size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Italic. Click once to toggle, click again to lock continuous formatting."
        isActive={editor.isActive('italic') || lockedFormatKey === 'italic'}
        isLocked={lockedFormatKey === 'italic'}
        onClick={() => handleStandardButtonClick('italic', () => editor.chain().focus().toggleItalic().run())}
        onDoubleClick={() => toggleLockedFormat('italic')}
      >
        <Italic size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Underline. Click once to toggle, click again to lock continuous formatting."
        isActive={editor.isActive('underline') || lockedFormatKey === 'underline'}
        isLocked={lockedFormatKey === 'underline'}
        onClick={() => handleStandardButtonClick('underline', () => editor.chain().focus().toggleUnderline().run())}
        onDoubleClick={() => toggleLockedFormat('underline')}
      >
        <Underline size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Strikethrough. Click once to toggle, click again to lock continuous formatting."
        isActive={editor.isActive('strike') || lockedFormatKey === 'strike'}
        isLocked={lockedFormatKey === 'strike'}
        onClick={() => handleStandardButtonClick('strike', () => editor.chain().focus().toggleStrike().run())}
        onDoubleClick={() => toggleLockedFormat('strike')}
      >
        <Strikethrough size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <div className="w-px h-5 bg-pencil/20 mx-1" />

      <ToolbarButton
        title="Heading 1. Click once to toggle, click again to lock continuous formatting."
        isActive={editor.isActive('heading', { level: 1 }) || lockedFormatKey === 'heading-1'}
        isLocked={lockedFormatKey === 'heading-1'}
        onClick={() => handleStandardButtonClick('heading-1', () => editor.chain().focus().toggleHeading({ level: 1 }).run())}
        onDoubleClick={() => toggleLockedFormat('heading-1')}
      >
        <Heading1 size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Heading 2. Click once to toggle, click again to lock continuous formatting."
        isActive={editor.isActive('heading', { level: 2 }) || lockedFormatKey === 'heading-2'}
        isLocked={lockedFormatKey === 'heading-2'}
        onClick={() => handleStandardButtonClick('heading-2', () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
        onDoubleClick={() => toggleLockedFormat('heading-2')}
      >
        <Heading2 size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Heading 3. Click once to toggle, click again to lock continuous formatting."
        isActive={editor.isActive('heading', { level: 3 }) || lockedFormatKey === 'heading-3'}
        isLocked={lockedFormatKey === 'heading-3'}
        onClick={() => handleStandardButtonClick('heading-3', () => editor.chain().focus().toggleHeading({ level: 3 }).run())}
        onDoubleClick={() => toggleLockedFormat('heading-3')}
      >
        <Heading3 size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <div className="w-px h-5 bg-pencil/20 mx-1" />

      <ToolbarButton
        title="Bullet List. Click once to toggle, click again to lock continuous formatting."
        isActive={editor.isActive('bulletList') || lockedFormatKey === 'bullet-list'}
        isLocked={lockedFormatKey === 'bullet-list'}
        onClick={() => handleStandardButtonClick('bullet-list', () => editor.chain().focus().toggleBulletList().run())}
        onDoubleClick={() => toggleLockedFormat('bullet-list')}
      >
        <List size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Numbered List. Click once to toggle, click again to lock continuous formatting."
        isActive={editor.isActive('orderedList') || lockedFormatKey === 'ordered-list'}
        isLocked={lockedFormatKey === 'ordered-list'}
        onClick={() => handleStandardButtonClick('ordered-list', () => editor.chain().focus().toggleOrderedList().run())}
        onDoubleClick={() => toggleLockedFormat('ordered-list')}
      >
        <ListOrdered size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <div className="w-px h-5 bg-pencil/20 mx-1" />

      <div ref={highlightToolRef} className="relative">
        <ToolbarButton
          title={editor.state.selection.empty && editor.isActive('highlight') ? 'Remove highlight. Click again to lock continuous formatting.' : 'Highlight. Click again to lock continuous formatting.'}
          isActive={editor.isActive('highlight') || showHighlightPalette || lockedFormatKey === 'highlight'}
          isLocked={lockedFormatKey === 'highlight'}
          onClick={handleToggleHighlight}
          onDoubleClick={() => toggleLockedFormat('highlight')}
        >
          <Highlighter size={18} strokeWidth={2.5} />
        </ToolbarButton>

        {showHighlightPalette && (
          <div
            className="absolute left-0 top-full mt-2 flex items-center gap-1 rounded border-2 border-pencil bg-white/95 px-2 py-2 shadow-hard dark:border-pencil-dark dark:bg-paper-dark/95"
            style={{ borderRadius: '12px' }}
          >
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                title={`Use highlight ${color}`}
                onClick={() => handleHighlightColorChange(color)}
                className={`h-5 w-5 rounded-full border transition-transform hover:scale-110 ${
                  highlightColor === color ? 'border-pencil shadow-sm dark:border-pencil-dark' : 'border-pencil/20 dark:border-pencil-dark/20'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        )}
      </div>

      <ToolbarButton
        title="Blockquote. Click once to toggle, click again to lock continuous formatting."
        isActive={editor.isActive('blockquote') || lockedFormatKey === 'blockquote'}
        isLocked={lockedFormatKey === 'blockquote'}
        onClick={() => handleStandardButtonClick('blockquote', () => editor.chain().focus().toggleBlockquote().run())}
        onDoubleClick={() => toggleLockedFormat('blockquote')}
      >
        <Quote size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Code Block. Click once to toggle, click again to lock continuous formatting."
        isActive={editor.isActive('codeBlock') || lockedFormatKey === 'code-block'}
        isLocked={lockedFormatKey === 'code-block'}
        onClick={() => handleStandardButtonClick('code-block', () => editor.chain().focus().toggleCodeBlock().run())}
        onDoubleClick={() => toggleLockedFormat('code-block')}
      >
        <Code size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Horizontal Rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Subscript. Click once to toggle, click again to lock continuous formatting."
        isActive={editor.isActive('subscript') || lockedFormatKey === 'subscript'}
        isLocked={lockedFormatKey === 'subscript'}
        onClick={() => handleStandardButtonClick('subscript', () => editor.chain().focus().toggleSubscript().run())}
        onDoubleClick={() => toggleLockedFormat('subscript')}
      >
        <Subscript size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Superscript. Click once to toggle, click again to lock continuous formatting."
        isActive={editor.isActive('superscript') || lockedFormatKey === 'superscript'}
        isLocked={lockedFormatKey === 'superscript'}
        onClick={() => handleStandardButtonClick('superscript', () => editor.chain().focus().toggleSuperscript().run())}
        onDoubleClick={() => toggleLockedFormat('superscript')}
      >
        <Superscript size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <div className="w-px h-5 bg-pencil/20 mx-1" />

      <ToolbarButton
        title="Align Left. Click once to apply, click again to lock continuous formatting."
        isActive={editor.isActive({ textAlign: 'left' }) || lockedFormatKey === 'align-left'}
        isLocked={lockedFormatKey === 'align-left'}
        onClick={() => handleStandardButtonClick('align-left', () => editor.chain().focus().setTextAlign('left').run())}
        onDoubleClick={() => toggleLockedFormat('align-left')}
      >
        <AlignLeft size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Align Center. Click once to apply, click again to lock continuous formatting."
        isActive={editor.isActive({ textAlign: 'center' }) || lockedFormatKey === 'align-center'}
        isLocked={lockedFormatKey === 'align-center'}
        onClick={() => handleStandardButtonClick('align-center', () => editor.chain().focus().setTextAlign('center').run())}
        onDoubleClick={() => toggleLockedFormat('align-center')}
      >
        <AlignCenter size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Align Right. Click once to apply, click again to lock continuous formatting."
        isActive={editor.isActive({ textAlign: 'right' }) || lockedFormatKey === 'align-right'}
        isLocked={lockedFormatKey === 'align-right'}
        onClick={() => handleStandardButtonClick('align-right', () => editor.chain().focus().setTextAlign('right').run())}
        onDoubleClick={() => toggleLockedFormat('align-right')}
      >
        <AlignRight size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <div className="w-px h-5 bg-pencil/20 mx-1" />

      <ToolbarButton
        title="Insert Link"
        isActive={editor.isActive('link')}
        onClick={() => {
          if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run()
            return
          }
          const url = window.prompt('Enter URL:')
          if (url) {
            editor.chain().focus().setLink({ href: url }).run()
          }
        }}
      >
        <Link2 size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Insert Image"
        onClick={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = 'image/*'
          input.onchange = () => {
            const file = input.files?.[0]
            if (file) {
              const reader = new FileReader()
              reader.onload = () => {
                const url = reader.result as string
                editor.chain().focus().setImage({ src: url }).run()
              }
              reader.readAsDataURL(file)
            }
          }
          input.click()
        }}
      >
        <ImageIcon size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Clear Formatting"
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
      >
        <RemoveFormatting size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <div className="w-px h-5 bg-pencil/20 mx-1" />

      <ToolbarButton
        title="Undo"
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Redo"
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <div className="w-px h-5 bg-pencil/20 mx-1" />

      <button
        title={highlightPopupEnabled ? 'Translation mode ON — click to disable' : 'Translation mode OFF — click to enable'}
        onClick={() => updateSettings({ highlightPopupEnabled: !highlightPopupEnabled })}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-body transition-colors ${
          highlightPopupEnabled
            ? 'bg-pen/15 text-pen dark:bg-blue-900/30 dark:text-blue-300 border border-pen/30'
            : 'bg-erased/50 text-pencil/40 dark:bg-erased-dark/50 dark:text-pencil-dark/40 border border-pencil/20'
        }`}
      >
        <Languages size={14} strokeWidth={2.5} />
        {highlightPopupEnabled ? 'Translate ON' : 'Translate OFF'}
      </button>

      {lockedFormat && (
        <button
          type="button"
          onClick={() => setLockedFormatKey(null)}
          className="ml-auto flex items-center gap-1 rounded-full border border-pen/25 bg-pen/10 px-2.5 py-1 text-xs font-body text-pen transition-colors hover:bg-pen/15 dark:border-blue-300/30 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
          title={`Continuous ${lockedFormat.label} is active. Press Escape or click to stop.`}
        >
          <Pin size={12} strokeWidth={2.5} />
          {lockedFormat.label}
          <span className="text-[10px] uppercase tracking-[0.18em] opacity-70">continuous</span>
          <X size={12} strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}
