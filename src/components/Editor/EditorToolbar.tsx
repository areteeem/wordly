import type { Editor } from '@tiptap/react'
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
} from 'lucide-react'

interface EditorToolbarProps {
  editor: Editor
}

function ToolbarButton({
  isActive,
  onClick,
  children,
  title,
}: {
  isActive?: boolean
  onClick: () => void
  children: React.ReactNode
  title: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        isActive
          ? 'bg-pencil text-white dark:bg-pencil-dark dark:text-paper-dark'
          : 'text-pencil dark:text-pencil-dark hover:bg-erased dark:hover:bg-erased-dark'
      }`}
    >
      {children}
    </button>
  )
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  return (
    <div className="flex items-center gap-1 px-6 pb-2 flex-wrap">
      <ToolbarButton
        title="Bold"
        isActive={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Italic"
        isActive={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Underline"
        isActive={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Strikethrough"
        isActive={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <div className="w-px h-5 bg-pencil/20 mx-1" />

      <ToolbarButton
        title="Heading 1"
        isActive={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Heading 2"
        isActive={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Heading 3"
        isActive={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <div className="w-px h-5 bg-pencil/20 mx-1" />

      <ToolbarButton
        title="Bullet List"
        isActive={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Numbered List"
        isActive={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <div className="w-px h-5 bg-pencil/20 mx-1" />

      <ToolbarButton
        title="Highlight"
        isActive={editor.isActive('highlight')}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      >
        <Highlighter size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Blockquote"
        isActive={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Code Block"
        isActive={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
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
        title="Subscript"
        isActive={editor.isActive('subscript')}
        onClick={() => editor.chain().focus().toggleSubscript().run()}
      >
        <Subscript size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Superscript"
        isActive={editor.isActive('superscript')}
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
      >
        <Superscript size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <div className="w-px h-5 bg-pencil/20 mx-1" />

      <ToolbarButton
        title="Align Left"
        isActive={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      >
        <AlignLeft size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Align Center"
        isActive={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      >
        <AlignCenter size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        title="Align Right"
        isActive={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
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
    </div>
  )
}
