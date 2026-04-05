import { useMemo } from 'react'
import { FileText, FolderOpen, BookOpen, Plus, Clock, TrendingUp } from 'lucide-react'
import { useDocumentStore } from '../../stores/documentStore'
import { useVocabularyStore } from '../../stores/vocabularyStore'
import { useFolderStore } from '../../stores/folderStore'
import { Button } from '../ui/Button'
import { wobblyMd, wobbly } from '../../lib/utils'

export function MainPage() {
  const documents = useDocumentStore((s) => s.documents)
  const createDocument = useDocumentStore((s) => s.createDocument)
  const setActiveDocument = useDocumentStore((s) => s.setActiveDocument)
  const entries = useVocabularyStore((s) => s.entries)
  const activeFolderId = useFolderStore((s) => s.activeFolderId)
  const folders = useFolderStore((s) => s.folders)

  const recentDocs = useMemo(() => {
    return [...documents].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6)
  }, [documents])

  const todayCount = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return entries.filter((e) => e.createdAt >= today.getTime()).length
  }, [entries])

  const stats = [
    { label: 'Documents', value: documents.length, icon: FileText },
    { label: 'Words Learned', value: entries.length, icon: BookOpen },
    { label: 'Added Today', value: todayCount, icon: TrendingUp },
    { label: 'Folders', value: folders.length, icon: FolderOpen },
  ]

  return (
    <div className="flex-1 flex flex-col items-center overflow-y-auto py-8 px-6">
      <div className="max-w-3xl w-full">
        {/* Welcome */}
        <div className="text-center mb-10">
          <h1
            className="font-heading text-5xl md:text-6xl text-pencil dark:text-pencil-dark mb-2"
            style={{ transform: 'rotate(-2deg)' }}
          >
            Welcome to Wordly
            <span className="inline-block text-marker ml-1 animate-bounce" style={{ animationDuration: '3s' }}>!</span>
          </h1>
          <p className="font-body text-xl text-pencil/60 dark:text-pencil-dark/60">
            Your personal vocabulary builder. Read, highlight, learn.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark p-4 text-center transition-transform duration-100 hover:rotate-1"
              style={{ borderRadius: wobblyMd, boxShadow: '3px 3px 0px 0px rgba(45,45,45,0.1)' }}
            >
              <stat.icon size={24} strokeWidth={2.5} className="mx-auto mb-1 text-pen" />
              <p className="font-heading text-3xl text-pencil dark:text-pencil-dark">{stat.value}</p>
              <p className="font-body text-sm text-pencil/50 dark:text-pencil-dark/50">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="flex gap-3 mb-10 justify-center flex-wrap">
          <Button onClick={() => createDocument(activeFolderId)} size="md">
            <Plus size={18} strokeWidth={2.5} />
            New Document
          </Button>
        </div>

        {/* Recent documents */}
        {recentDocs.length > 0 && (
          <div>
            <h2
              className="font-heading text-2xl text-pencil dark:text-pencil-dark mb-4 flex items-center gap-2"
              style={{ transform: 'rotate(-1deg)' }}
            >
              <Clock size={20} strokeWidth={2.5} />
              Recent Documents
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recentDocs.map((doc) => {
                const folder = folders.find((f) => f.id === doc.folderId)
                const wordCount = entries.filter((e) => e.documentId === doc.id).length
                const preview = doc.content
                  ? doc.content.replace(/<[^>]*>/g, '').substring(0, 80)
                  : 'Empty document'

                return (
                  <button
                    key={doc.id}
                    onClick={() => setActiveDocument(doc.id)}
                    className="text-left bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark p-4 transition-all duration-100 hover:rotate-[0.5deg] hover:shadow-hard dark:hover:shadow-hard-dark group"
                    style={{ borderRadius: wobblyMd, boxShadow: '3px 3px 0px 0px rgba(45,45,45,0.1)' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText size={16} strokeWidth={2.5} className="text-pen flex-shrink-0" />
                      <h3 className="font-heading text-lg text-pencil dark:text-pencil-dark truncate group-hover:text-pen transition-colors">
                        {doc.title || 'Untitled'}
                      </h3>
                    </div>
                    <p className="font-body text-sm text-pencil/40 dark:text-pencil-dark/40 truncate mb-2">
                      {preview}
                    </p>
                    <div className="flex items-center gap-3 font-body text-xs text-pencil/30 dark:text-pencil-dark/30">
                      <span>{folder?.name || 'Inbox'}</span>
                      <span>·</span>
                      <span>{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
                      <span>·</span>
                      <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {recentDocs.length === 0 && (
          <div
            className="text-center bg-postit border-2 border-pencil dark:border-pencil-dark p-8"
            style={{ borderRadius: wobblyMd, transform: 'rotate(1deg)' }}
          >
            <p className="font-heading text-2xl text-pencil mb-2">
              No documents yet!
            </p>
            <p className="font-body text-lg text-pencil/60 mb-4">
              Create your first document and start building your vocabulary.
            </p>
            <Button onClick={() => createDocument(activeFolderId)} size="md">
              <Plus size={18} strokeWidth={2.5} />
              Get Started
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
