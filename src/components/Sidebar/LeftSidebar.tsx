import { useState } from 'react'
import {
  FolderOpen,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Trash2,
  Pencil,
  Inbox,
  FileText,
  FilePlus,
  GripVertical,
} from 'lucide-react'
import { useFolderStore } from '../../stores/folderStore'
import { useDocumentStore } from '../../stores/documentStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { INBOX_FOLDER_ID } from '../../types'
import { Input } from '../ui/Input'
import { wobbly } from '../../lib/utils'

export function LeftSidebar() {
  const folders = useFolderStore((s) => s.folders)
  const activeFolderId = useFolderStore((s) => s.activeFolderId)
  const addFolder = useFolderStore((s) => s.addFolder)
  const renameFolder = useFolderStore((s) => s.renameFolder)
  const deleteFolder = useFolderStore((s) => s.deleteFolder)
  const setActiveFolder = useFolderStore((s) => s.setActiveFolder)

  const documents = useDocumentStore((s) => s.documents)
  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)
  const createDocument = useDocumentStore((s) => s.createDocument)
  const deleteDocument = useDocumentStore((s) => s.deleteDocument)
  const setActiveDocument = useDocumentStore((s) => s.setActiveDocument)
  const moveDocument = useDocumentStore((s) => s.moveDocument)
  const notify = useSettingsStore((s) => s.notify)

  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set([INBOX_FOLDER_ID]),
  )
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null)
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null)

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setActiveFolder(id)
  }

  const handleAddFolder = () => {
    if (!newFolderName.trim()) return
    addFolder(newFolderName.trim())
    setNewFolderName('')
    setShowNewFolder(false)
  }

  const handleRename = (id: string) => {
    if (editingName.trim()) {
      renameFolder(id, editingName.trim())
    }
    setEditingFolderId(null)
  }

  const handleDragStart = (docId: string) => {
    setDraggedDocId(docId)
  }

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTargetFolderId(folderId)
  }

  const handleDragLeave = () => {
    setDropTargetFolderId(null)
  }

  const handleDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault()
    setDropTargetFolderId(null)
    if (draggedDocId) {
      const doc = documents.find((d) => d.id === draggedDocId)
      if (doc && doc.folderId !== folderId) {
        moveDocument(draggedDocId, folderId)
        const folder = folders.find((f) => f.id === folderId)
        notify(`Moved to ${folder?.name || 'folder'}`)
      }
      setDraggedDocId(null)
    }
  }

  const handleDragEnd = () => {
    setDraggedDocId(null)
    setDropTargetFolderId(null)
  }

  const rootFolders = folders.filter((f) => f.parentId === null)

  return (
    <aside className="w-full flex-shrink-0 border-r-2 border-dashed border-pencil/20 dark:border-pencil-dark/20 flex flex-col h-full bg-paper/50 dark:bg-paper-dark/50 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b-2 border-dashed border-pencil/20 dark:border-pencil-dark/20">
        <h2
          className="font-heading text-2xl text-pencil dark:text-pencil-dark"
          style={{ transform: 'rotate(-1deg)' }}
        >
          📂 Folders
        </h2>
      </div>

      {/* Folder tree */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {rootFolders.map((folder) => {
          const isExpanded = expandedFolders.has(folder.id)
          const isActive = activeFolderId === folder.id
          const docCount = documents.filter((d) => d.folderId === folder.id).length
          const isInbox = folder.id === INBOX_FOLDER_ID

          return (
            <div key={folder.id}>
              <div
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer font-body text-lg transition-colors group ${
                  isActive
                    ? 'bg-postit border-2 border-pencil dark:border-pencil-dark'
                    : 'hover:bg-erased/50 dark:hover:bg-erased-dark/50 border-2 border-transparent'
                } ${dropTargetFolderId === folder.id ? 'folder-drop-target' : ''}`}
                style={{ borderRadius: wobbly }}
                onClick={() => toggleFolder(folder.id)}
                onDragOver={(e) => handleDragOver(e, folder.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, folder.id)}
              >
                {isExpanded ? (
                  <ChevronDown size={16} strokeWidth={2.5} />
                ) : (
                  <ChevronRight size={16} strokeWidth={2.5} />
                )}

                {isInbox ? (
                  <Inbox size={18} strokeWidth={2.5} />
                ) : (
                  <FolderOpen size={18} strokeWidth={2.5} />
                )}

                {editingFolderId === folder.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleRename(folder.id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRename(folder.id)}
                    className="bg-transparent border-b border-pencil outline-none flex-1 font-body text-lg"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 truncate">{folder.name}</span>
                )}

                <span className="text-sm text-pencil/40 dark:text-pencil-dark/40">
                  {docCount}
                </span>

                {!isInbox && (
                  <div className="hidden group-hover:flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingFolderId(folder.id)
                        setEditingName(folder.name)
                      }}
                      className="hover:text-pen"
                      title="Rename"
                    >
                      <Pencil size={14} strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteFolder(folder.id)
                      }}
                      className="hover:text-marker"
                      title="Delete"
                    >
                      <Trash2 size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                )}
              </div>

              {/* Documents in this folder */}
              {isExpanded && (
                <div className="ml-6 mt-1 space-y-0.5 animate-slide-in-up">
                  {documents
                    .filter((d) => d.folderId === folder.id)
                    .map((doc) => (
                      <div
                        key={doc.id}
                        draggable
                        onDragStart={() => handleDragStart(doc.id)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer font-body text-base transition-colors group ${
                          activeDocumentId === doc.id
                            ? 'text-pen font-bold'
                            : 'text-pencil/70 dark:text-pencil-dark/70 hover:text-pencil dark:hover:text-pencil-dark'
                        } ${draggedDocId === doc.id ? 'opacity-40' : ''}`}
                        onClick={() => setActiveDocument(doc.id)}
                      >
                        <GripVertical size={12} strokeWidth={2} className="text-pencil/20 flex-shrink-0 cursor-grab" />
                        <FileText size={14} strokeWidth={2.5} />
                        <span className="flex-1 truncate">{doc.title || 'Untitled'}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteDocument(doc.id)
                          }}
                          className="hidden group-hover:block hover:text-marker"
                          title="Delete document"
                        >
                          <Trash2 size={12} strokeWidth={2.5} />
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* New folder */}
      <div className="p-3 border-t-2 border-dashed border-pencil/20 dark:border-pencil-dark/20 space-y-2">
        {showNewFolder ? (
          <div className="flex gap-2">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
              placeholder="Folder name..."
              className="text-sm py-1"
              autoFocus
            />
            <button
              onClick={handleAddFolder}
              className="text-pen font-body text-sm whitespace-nowrap hover:underline"
            >
              Add
            </button>
            <button
              onClick={() => setShowNewFolder(false)}
              className="text-pencil/40 font-body text-sm hover:text-marker"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewFolder(true)}
            className="flex items-center gap-2 font-body text-base text-pencil/60 dark:text-pencil-dark/60 hover:text-pencil dark:hover:text-pencil-dark transition-colors w-full"
          >
            <FolderPlus size={16} strokeWidth={2.5} />
            New Folder
          </button>
        )}

        <button
          onClick={() => createDocument(activeFolderId)}
          className="flex items-center gap-2 font-body text-base text-pencil/60 dark:text-pencil-dark/60 hover:text-pencil dark:hover:text-pencil-dark transition-colors w-full"
        >
          <FilePlus size={16} strokeWidth={2.5} />
          New Document
        </button>
      </div>
    </aside>
  )
}
