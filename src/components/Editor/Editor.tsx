import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDocumentStore } from '../../stores/documentStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useFolderStore } from '../../stores/folderStore'
import { EditorToolbar } from './EditorToolbar'
import { HighlightPopup } from './HighlightPopup'
import { MainPage } from '../MainPage/MainPage'
import { TagBadge } from '../ui/TagBadge'
import { wobblyMd } from '../../lib/utils'
import { ChevronRight, Home } from 'lucide-react'

export function Editor() {
  const activeDoc = useDocumentStore((s) => {
    const id = s.activeDocumentId
    return id ? s.documents.find((d) => d.id === id) : undefined
  })
  const updateContent = useDocumentStore((s) => s.updateContent)
  const updateTitle = useDocumentStore((s) => s.updateTitle)
  const updateDocTags = useDocumentStore((s) => s.updateTags)
  const saveStatus = useDocumentStore((s) => s.saveStatus)
  const setActiveDocument = useDocumentStore((s) => s.setActiveDocument)
  const scrollToPosition = useDocumentStore((s) => s.scrollToPosition)
  const setScrollToPosition = useDocumentStore((s) => s.setScrollToPosition)
  const fontSize = useSettingsStore((s) => s.settings.fontSize)
  const folders = useFolderStore((s) => s.folders)
  const setActiveFolder = useFolderStore((s) => s.setActiveFolder)

  const [selectionInfo, setSelectionInfo] = useState<{
    text: string
    rect: DOMRect
    sentence: string
    from: number
  } | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [isSelecting, setIsSelecting] = useState(false)
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSelectionRef = useRef<typeof selectionInfo>(null)

  const editorRef = useRef<HTMLDivElement>(null)

  // Apply font size CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`)
  }, [fontSize])

  // Track mouseup to finalize selection
  useEffect(() => {
    const handleMouseUp = () => {
      if (pendingSelectionRef.current) {
        // Re-read rect after mouseup for accurate positioning
        const domSel = window.getSelection()
        if (domSel && domSel.rangeCount > 0) {
          const range = domSel.getRangeAt(0)
          const rect = range.getBoundingClientRect()
          if (rect.width > 0) {
            pendingSelectionRef.current = { ...pendingSelectionRef.current, rect }
          }
        }
        if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current)
        // Small delay after mouseup for final position
        selectionTimerRef.current = setTimeout(() => {
          setSelectionInfo(pendingSelectionRef.current)
        }, 80)
      }
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Underline,
        Highlight.configure({ multicolor: false }),
        Placeholder.configure({
          placeholder: 'Start writing or paste text here...',
        }),
        Image.configure({ inline: false, allowBase64: true }),
        Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-pen underline decoration-pen/40 hover:decoration-pen cursor-pointer' } }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Subscript,
        Superscript,
      ],
      content: activeDoc?.content ?? '',
      onUpdate: ({ editor }) => {
        if (activeDoc) {
          updateContent(activeDoc.id, editor.getHTML())
        }
      },
      onSelectionUpdate: ({ editor }) => {
        const { from, to } = editor.state.selection
        if (from === to) {
          pendingSelectionRef.current = null
          if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current)
          setSelectionInfo(null)
          return
        }

        const text = editor.state.doc.textBetween(from, to, ' ')
        if (!text.trim()) {
          pendingSelectionRef.current = null
          if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current)
          setSelectionInfo(null)
          return
        }

        // Extract sentence context
        const fullText = editor.state.doc.textContent
        const textStart = fullText.substring(0, from)
        const textEnd = fullText.substring(to)
        const sentenceStart = Math.max(
          textStart.lastIndexOf('.') + 1,
          textStart.lastIndexOf('!') + 1,
          textStart.lastIndexOf('?') + 1,
          0,
        )
        const sentenceEndRel = Math.min(
          ...[textEnd.indexOf('.'), textEnd.indexOf('!'), textEnd.indexOf('?')]
            .filter((i) => i >= 0)
            .concat([textEnd.length]),
        )
        const sentence = fullText.substring(sentenceStart, to + sentenceEndRel + 1).trim()

        // Get selection rectangle
        const domSel = window.getSelection()
        if (domSel && domSel.rangeCount > 0) {
          const range = domSel.getRangeAt(0)
          const rect = range.getBoundingClientRect()
          const pending = { text: text.trim(), rect, sentence, from }
          pendingSelectionRef.current = pending

          // Debounce: only show popup after 250ms pause (selection settled)
          if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current)
          selectionTimerRef.current = setTimeout(() => {
            setSelectionInfo(pendingSelectionRef.current)
          }, 250)
        }
      },
      editorProps: {
        attributes: {
          class: 'ProseMirror focus:outline-none',
        },
        handleDrop: (view, event) => {
          const files = event.dataTransfer?.files
          if (files && files.length > 0) {
            for (const file of Array.from(files)) {
              if (file.type.startsWith('image/')) {
                event.preventDefault()
                const reader = new FileReader()
                reader.onload = () => {
                  const url = reader.result as string
                  editor?.chain().focus().setImage({ src: url }).run()
                }
                reader.readAsDataURL(file)
                return true
              }
            }
          }
          return false
        },
        handlePaste: (view, event) => {
          const items = event.clipboardData?.items
          if (items) {
            for (const item of Array.from(items)) {
              if (item.type.startsWith('image/')) {
                event.preventDefault()
                const file = item.getAsFile()
                if (file) {
                  const reader = new FileReader()
                  reader.onload = () => {
                    const url = reader.result as string
                    editor?.chain().focus().setImage({ src: url }).run()
                  }
                  reader.readAsDataURL(file)
                }
                return true
              }
            }
          }
          return false
        },
      },
    },
    [activeDoc?.id],
  )

  // Sync content when switching documents
  useEffect(() => {
    if (editor && activeDoc) {
      const currentContent = editor.getHTML()
      if (currentContent !== activeDoc.content) {
        editor.commands.setContent(activeDoc.content || '')
      }
    }
  }, [activeDoc?.id])

  // Scroll to word position when triggered from vocabulary sidebar
  useEffect(() => {
    if (editor && scrollToPosition !== null && scrollToPosition > 0) {
      try {
        const pos = Math.min(scrollToPosition, editor.state.doc.content.size - 1)
        editor.chain().focus().setTextSelection(pos).run()

        // Scroll the position into view
        const domAtPos = editor.view.domAtPos(pos)
        if (domAtPos && domAtPos.node) {
          const el = domAtPos.node instanceof HTMLElement ? domAtPos.node : domAtPos.node.parentElement
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            // Flash highlight effect
            el.style.transition = 'background-color 0.3s'
            el.style.backgroundColor = 'rgba(45, 93, 161, 0.25)'
            setTimeout(() => {
              el.style.backgroundColor = ''
              setTimeout(() => { el.style.transition = '' }, 300)
            }, 1500)
          }
        }
      } catch {
        // Position may be invalid if document content changed
      }
      setScrollToPosition(null)
    }
  }, [editor, scrollToPosition, setScrollToPosition])

  const wordCount = useMemo(() => {
    if (!editor) return 0
    const text = editor.state.doc.textContent
    return text.trim() ? text.trim().split(/\s+/).length : 0
  }, [editor?.state.doc.textContent])

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (activeDoc) updateTitle(activeDoc.id, e.target.value)
    },
    [activeDoc?.id, updateTitle],
  )

  const clearSelection = useCallback(() => {
    setSelectionInfo(null)
  }, [])

  const handleAddTag = () => {
    if (!activeDoc || !tagInput.trim()) return
    const tag = tagInput.trim()
    if (!activeDoc.tags.includes(tag)) {
      updateDocTags(activeDoc.id, [...activeDoc.tags, tag])
    }
    setTagInput('')
  }

  const handleRemoveTag = (tag: string) => {
    if (!activeDoc) return
    updateDocTags(activeDoc.id, activeDoc.tags.filter((t) => t !== tag))
  }

  const currentFolder = activeDoc ? folders.find((f) => f.id === activeDoc.folderId) : null

  // Show main page if no document is open
  if (!activeDoc) {
    return <MainPage />
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Breadcrumb navigation */}
      <div className="px-6 pt-2 flex items-center gap-1.5 font-body text-sm text-pencil/50 dark:text-pencil-dark/50">
        <button
          onClick={() => setActiveDocument(null)}
          className="hover:text-pencil dark:hover:text-pencil-dark transition-colors flex items-center gap-1"
        >
          <Home size={12} strokeWidth={2.5} />
          Home
        </button>
        <ChevronRight size={12} />
        <button
          onClick={() => {
            setActiveDocument(null)
            if (currentFolder) setActiveFolder(currentFolder.id)
          }}
          className="hover:text-pencil dark:hover:text-pencil-dark transition-colors"
        >
          {currentFolder?.name || 'Inbox'}
        </button>
        <ChevronRight size={12} />
        <span className="text-pencil dark:text-pencil-dark truncate max-w-[200px]">
          {activeDoc.title || 'Untitled'}
        </span>
      </div>

      {/* Title + save status */}
      <div className="px-6 pt-1 pb-1 flex items-center gap-3">
        <input
          type="text"
          value={activeDoc.title}
          onChange={handleTitleChange}
          className="font-heading text-3xl md:text-4xl bg-transparent border-none outline-none flex-1 text-pencil dark:text-pencil-dark placeholder:text-pencil/30"
          placeholder="Document Title"
        />
        <span className="font-body text-sm text-pencil/40 dark:text-pencil-dark/40 whitespace-nowrap">
          {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
        </span>
      </div>

      {/* Document tags */}
      <div className="px-6 pb-2 flex items-center gap-1.5 flex-wrap">
        {activeDoc.tags.map((tag) => (
          <TagBadge key={tag} label={tag} onRemove={() => handleRemoveTag(tag)} />
        ))}
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
          placeholder="+ add tag"
          className="font-body text-sm bg-transparent border-none outline-none w-20 text-pencil/40 placeholder:text-pencil/30"
        />
      </div>

      {/* Toolbar */}
      {editor && <EditorToolbar editor={editor} />}

      {/* Editor canvas */}
      <div
        ref={editorRef}
        className="flex-1 overflow-y-auto mx-4 md:mx-8 mb-4 bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark"
        style={{ borderRadius: wobblyMd, boxShadow: '3px 3px 0px 0px rgba(45,45,45,0.1)' }}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Word count footer */}
      <div className="px-6 pb-2 flex items-center justify-end">
        <span className="font-body text-xs text-pencil/30 dark:text-pencil-dark/30">
          {wordCount} word{wordCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Highlight popup */}
      {selectionInfo && activeDoc && (
        <HighlightPopup
          word={selectionInfo.text}
          sentence={selectionInfo.sentence}
          rect={selectionInfo.rect}
          documentId={activeDoc.id}
          positionInDoc={selectionInfo.from}
          onDone={clearSelection}
          editor={editor}
        />
      )}
    </div>
  )
}
