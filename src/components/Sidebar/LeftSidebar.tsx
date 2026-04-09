import { useMemo, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
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
  X,
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  )

  const draggedDocument = useMemo(
    () => documents.find((doc) => doc.id === draggedDocId) ?? null,
    [documents, draggedDocId],
  )

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

  const resetDragState = () => {
    setDraggedDocId(null)
    setDropTargetFolderId(null)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const docId = active.data.current?.docId as string | undefined
    const folderId = over?.data.current?.folderId as string | undefined

    if (docId && folderId) {
      const doc = documents.find((item) => item.id === docId)
      if (doc && doc.folderId !== folderId) {
        moveDocument(docId, folderId)
        const folder = folders.find((item) => item.id === folderId)
        notify(`Moved to ${folder?.name || 'folder'}`)
      }
    }

    resetDragState()
  }

  const rootFolders = folders.filter((f) => f.parentId === null)

  return (
    <aside className="w-full flex-shrink-0 border-r-2 border-dashed border-pencil/20 dark:border-pencil-dark/20 flex flex-col h-full bg-paper/50 dark:bg-paper-dark/50 overflow-hidden">
      <div className="p-4 border-b-2 border-dashed border-pencil/20 dark:border-pencil-dark/20">
        <div className="flex items-center gap-2" style={{ transform: 'rotate(-1deg)' }}>
          <FolderOpen size={20} strokeWidth={2.5} className="text-pencil dark:text-pencil-dark" />
          <h2 className="font-heading text-2xl text-pencil dark:text-pencil-dark">Folders</h2>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={({ active }) => setDraggedDocId((active.data.current?.docId as string) ?? null)}
        onDragOver={({ over }) => setDropTargetFolderId((over?.data.current?.folderId as string) ?? null)}
        onDragEnd={handleDragEnd}
        onDragCancel={resetDragState}
      >
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {rootFolders.map((folder) => {
            const isExpanded = expandedFolders.has(folder.id)
            const isActive = activeFolderId === folder.id
            const docCount = documents.filter((d) => d.folderId === folder.id).length
            const isInbox = folder.id === INBOX_FOLDER_ID

            return (
              <div key={folder.id}>
                <FolderRow
                  folderId={folder.id}
                  folderName={folder.name}
                  docCount={docCount}
                  isActive={isActive}
                  isExpanded={isExpanded}
                  isInbox={isInbox}
                  isDropTarget={dropTargetFolderId === folder.id}
                  editingFolderId={editingFolderId}
                  editingName={editingName}
                  onEditingNameChange={setEditingName}
                  onClick={() => toggleFolder(folder.id)}
                  onRename={() => handleRename(folder.id)}
                  onStartEditing={() => {
                    setEditingFolderId(folder.id)
                    setEditingName(folder.name)
                  }}
                  onDelete={() => deleteFolder(folder.id)}
                />

                {isExpanded && (
                  <div className="ml-6 mt-1 space-y-0.5 animate-slide-in-up">
                    {documents
                      .filter((d) => d.folderId === folder.id)
                      .map((doc) => (
                        <DraggableDocumentRow
                          key={doc.id}
                          docId={doc.id}
                          title={doc.title || 'Untitled'}
                          isActive={activeDocumentId === doc.id}
                          isDragging={draggedDocId === doc.id}
                          onOpen={() => setActiveDocument(doc.id)}
                          onDelete={() => deleteDocument(doc.id)}
                        />
                      ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <DragOverlay>
          {draggedDocument ? (
            <div
              className="flex items-center gap-2 border-2 border-pencil bg-white px-3 py-2 font-body text-base text-pencil shadow-hard dark:border-pencil-dark dark:bg-paper-dark dark:text-pencil-dark drag-ghost-enhanced"
              style={{ borderRadius: wobbly }}
            >
              <GripVertical size={12} strokeWidth={2} className="text-pencil/30" />
              <FileText size={14} strokeWidth={2.5} />
              <span className="max-w-[220px] truncate">{draggedDocument.title || 'Untitled'}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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
              className="text-pencil/40 hover:text-marker"
              title="Close"
            >
              <X size={14} strokeWidth={2.5} />
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

function FolderRow({
  folderId,
  folderName,
  docCount,
  isActive,
  isExpanded,
  isInbox,
  isDropTarget,
  editingFolderId,
  editingName,
  onEditingNameChange,
  onClick,
  onRename,
  onStartEditing,
  onDelete,
}: {
  folderId: string
  folderName: string
  docCount: number
  isActive: boolean
  isExpanded: boolean
  isInbox: boolean
  isDropTarget: boolean
  editingFolderId: string | null
  editingName: string
  onEditingNameChange: (value: string) => void
  onClick: () => void
  onRename: () => void
  onStartEditing: () => void
  onDelete: () => void
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `folder:${folderId}`,
    data: { folderId },
  })

  const showDropState = isDropTarget || isOver

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 px-3 py-2 cursor-pointer font-body text-lg transition-colors group ${
        isActive
          ? 'bg-postit border-2 border-pencil dark:border-pencil-dark'
          : 'hover:bg-erased/50 dark:hover:bg-erased-dark/50 border-2 border-transparent'
      } ${showDropState ? 'bg-pen/10 dark:bg-pen/20 border-pen ring-2 ring-pen/30 drop-zone-pulse' : ''}`}
      style={{ borderRadius: wobbly }}
      onClick={onClick}
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

      {editingFolderId === folderId ? (
        <input
          type="text"
          value={editingName}
          onChange={(e) => onEditingNameChange(e.target.value)}
          onBlur={onRename}
          onKeyDown={(e) => e.key === 'Enter' && onRename()}
          className="bg-transparent border-b border-pencil outline-none flex-1 font-body text-lg"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 truncate">{folderName}</span>
      )}

      <span className="text-sm text-pencil/40 dark:text-pencil-dark/40">{docCount}</span>

      {!isInbox && (
        <div className="hidden group-hover:flex items-center gap-1">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onStartEditing()
            }}
            className="hover:text-pen"
            title="Rename"
          >
            <Pencil size={14} strokeWidth={2.5} />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="hover:text-marker"
            title="Delete"
          >
            <Trash2 size={14} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  )
}

function DraggableDocumentRow({
  docId,
  title,
  isActive,
  isDragging,
  onOpen,
  onDelete,
}: {
  docId: string
  title: string
  isActive: boolean
  isDragging: boolean
  onOpen: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `doc:${docId}`,
    data: { docId },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2 px-3 py-1.5 cursor-grab active:cursor-grabbing font-body text-base transition-all group ${
        isActive
          ? 'text-pen font-bold'
          : 'text-pencil/70 dark:text-pencil-dark/70 hover:text-pencil dark:hover:text-pencil-dark'
      } ${isDragging ? 'scale-95 opacity-30 drag-source-dim' : 'hover:bg-erased/30 dark:hover:bg-erased-dark/30'}`}
      onClick={onOpen}
    >
      <GripVertical size={12} strokeWidth={2} className="text-pencil/30 flex-shrink-0" />
      <FileText size={14} strokeWidth={2.5} />
      <span className="flex-1 truncate">{title}</span>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="hidden group-hover:block hover:text-marker"
        title="Delete document"
      >
        <Trash2 size={12} strokeWidth={2.5} />
      </button>
    </div>
  )
}
