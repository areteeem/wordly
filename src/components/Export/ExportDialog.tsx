import { useState, useMemo } from 'react'
import { X, Download, FileText, FolderOpen, Tag, Printer, Check } from 'lucide-react'
import { useVocabularyStore } from '../../stores/vocabularyStore'
import { useDocumentStore } from '../../stores/documentStore'
import { useFolderStore } from '../../stores/folderStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { exportCSV, exportTable, exportText, downloadFile } from '../../services/export'
import { wobbly, wobblyMd } from '../../lib/utils'
import type { VocabularyEntry } from '../../types'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
}

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const entries = useVocabularyStore((s) => s.entries)
  const documents = useDocumentStore((s) => s.documents)
  const folders = useFolderStore((s) => s.folders)
  const notify = useSettingsStore((s) => s.notify)
  const csvDelimiter = useSettingsStore((s) => s.settings.csvDelimiter)

  const [exportScope, setExportScope] = useState<'all' | 'folder' | 'tag' | 'document' | 'selected'>('all')
  const [selectedFolderId, setSelectedFolderId] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [selectedDocId, setSelectedDocId] = useState('')
  const [format, setFormat] = useState<'csv' | 'table' | 'text' | 'anki' | 'pdf'>('csv')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(entries.map((e) => e.id)))
  const [studentName, setStudentName] = useState('')
  const [includeDate, setIncludeDate] = useState(true)
  const [includeContext, setIncludeContext] = useState(true)

  const allTags = useMemo(() => {
    const tags = new Map<string, number>()
    entries.forEach((e) => e.tags.forEach((t) => tags.set(t, (tags.get(t) || 0) + 1)))
    return Array.from(tags.entries())
  }, [entries])

  const filteredEntries = useMemo(() => {
    let result = entries

    if (exportScope === 'folder' && selectedFolderId) {
      const docIds = documents.filter((d) => d.folderId === selectedFolderId).map((d) => d.id)
      result = result.filter((e) => docIds.includes(e.documentId))
    } else if (exportScope === 'tag' && selectedTag) {
      result = result.filter((e) => e.tags.includes(selectedTag))
    } else if (exportScope === 'document' && selectedDocId) {
      result = result.filter((e) => e.documentId === selectedDocId)
    } else if (exportScope === 'selected') {
      result = result.filter((e) => selectedIds.has(e.id))
    }

    return result
  }, [entries, exportScope, selectedFolderId, selectedTag, selectedDocId, selectedIds, documents])

  const toggleSelectEntry = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleExport = () => {
    if (filteredEntries.length === 0) {
      notify('No words to export', 'info')
      return
    }

    const dateStr = new Date().toLocaleDateString()
    const namePrefix = studentName ? `${studentName} - ` : ''

    switch (format) {
      case 'csv': {
        const csv = exportCSV(filteredEntries, csvDelimiter)
        downloadFile(csv, `${namePrefix}vocabulary.csv`)
        break
      }
      case 'table': {
        const table = exportTable(filteredEntries)
        navigator.clipboard.writeText(table)
        notify('Table copied to clipboard!')
        onClose()
        return
      }
      case 'text': {
        const text = exportText(filteredEntries, includeContext ? 'expanded' : 'clean')
        let content = ''
        if (studentName) content += `Student: ${studentName}\n`
        if (includeDate) content += `Date: ${dateStr}\n`
        if (content) content += `Words: ${filteredEntries.length}\n\n`
        content += text
        downloadFile(content, `${namePrefix}vocabulary.txt`, 'text/plain')
        break
      }
      case 'anki': {
        // Anki tab-separated format: front\tback
        const anki = filteredEntries.map((e) => {
          const front = e.word
          const back = e.translation + (e.contextSentence ? `<br><i>${e.contextSentence}</i>` : '')
          return `${front}\t${back}`
        }).join('\n')
        downloadFile(anki, `${namePrefix}anki-deck.txt`, 'text/plain')
        break
      }
      case 'pdf': {
        // Generate printable HTML and open in new window for printing
        const html = generatePrintHTML(filteredEntries, studentName, dateStr, includeContext)
        const win = window.open('', '_blank')
        if (win) {
          win.document.write(html)
          win.document.close()
          setTimeout(() => win.print(), 500)
        }
        break
      }
    }

    notify(`Exported ${filteredEntries.length} words!`)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-pencil/20 dark:bg-black/40" onClick={onClose} />
      <div
        className="relative bg-paper dark:bg-paper-dark border-[3px] border-pencil dark:border-pencil-dark w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-hard-lg dark:shadow-hard-lg-dark animate-pop-in z-50"
        style={{ borderRadius: wobblyMd }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b-2 border-dashed border-pencil/20 dark:border-pencil-dark/20">
          <h2 className="font-heading text-3xl text-pencil dark:text-pencil-dark" style={{ transform: 'rotate(-1deg)' }}>
            📤 Export Vocabulary
          </h2>
          <button onClick={onClose} className="text-pencil/60 hover:text-marker">
            <X size={24} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Scope */}
          <div>
            <label className="font-heading text-lg text-pencil dark:text-pencil-dark mb-2 block">What to export</label>
            <div className="flex flex-wrap gap-2">
              {([
                { scope: 'all' as const, label: 'All Words', icon: FileText },
                { scope: 'folder' as const, label: 'By Folder', icon: FolderOpen },
                { scope: 'tag' as const, label: 'By Tag', icon: Tag },
                { scope: 'document' as const, label: 'By Document', icon: FileText },
                { scope: 'selected' as const, label: 'Select Words', icon: Check },
              ]).map(({ scope, label, icon: Icon }) => (
                <button
                  key={scope}
                  onClick={() => setExportScope(scope)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 font-body text-sm border-2 border-pencil dark:border-pencil-dark transition-colors ${
                    exportScope === scope
                      ? 'bg-pencil text-white dark:bg-pencil-dark dark:text-paper-dark'
                      : 'bg-white dark:bg-paper-dark hover:bg-erased'
                  }`}
                  style={{ borderRadius: wobbly }}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>

            {/* Scope-specific selectors */}
            {exportScope === 'folder' && (
              <select
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="mt-2 w-full font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-3 py-2 outline-none"
                style={{ borderRadius: wobbly }}
              >
                <option value="">Select folder...</option>
                {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            )}

            {exportScope === 'tag' && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="mt-2 w-full font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-3 py-2 outline-none"
                style={{ borderRadius: wobbly }}
              >
                <option value="">Select tag...</option>
                {allTags.map(([tag, count]) => <option key={tag} value={tag}>{tag} ({count})</option>)}
              </select>
            )}

            {exportScope === 'document' && (
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="mt-2 w-full font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-3 py-2 outline-none"
                style={{ borderRadius: wobbly }}
              >
                <option value="">Select document...</option>
                {documents.map((d) => <option key={d.id} value={d.id}>{d.title || 'Untitled'}</option>)}
              </select>
            )}

            {exportScope === 'selected' && (
              <div className="mt-2 max-h-[200px] overflow-y-auto border-2 border-pencil/20 p-2 space-y-0.5" style={{ borderRadius: wobbly }}>
                <label className="flex items-center gap-2 font-body text-xs text-pencil/50 mb-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === entries.length}
                    onChange={() => {
                      if (selectedIds.size === entries.length) setSelectedIds(new Set())
                      else setSelectedIds(new Set(entries.map((e) => e.id)))
                    }}
                    className="w-3.5 h-3.5"
                  />
                  Select all ({entries.length})
                </label>
                {entries.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 font-body text-sm cursor-pointer hover:bg-erased/30 px-1 py-0.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(e.id)}
                      onChange={() => toggleSelectEntry(e.id)}
                      className="w-3.5 h-3.5"
                    />
                    <span className="font-bold text-pencil dark:text-pencil-dark">{e.word}</span>
                    <span className="text-pen dark:text-blue-300">— {e.translation}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Format */}
          <div>
            <label className="font-heading text-lg text-pencil dark:text-pencil-dark mb-2 block">Format</label>
            <div className="flex flex-wrap gap-2">
              {([
                { fmt: 'csv' as const, label: 'CSV' },
                { fmt: 'text' as const, label: 'Text' },
                { fmt: 'table' as const, label: 'Markdown Table' },
                { fmt: 'anki' as const, label: 'Anki Deck' },
                { fmt: 'pdf' as const, label: 'PDF / Print' },
              ]).map(({ fmt, label }) => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  className={`px-3 py-1.5 font-body text-sm border-2 border-pencil dark:border-pencil-dark transition-colors ${
                    format === fmt
                      ? 'bg-pencil text-white dark:bg-pencil-dark dark:text-paper-dark'
                      : 'bg-white dark:bg-paper-dark hover:bg-erased'
                  }`}
                  style={{ borderRadius: wobbly }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="font-heading text-lg text-pencil dark:text-pencil-dark block">Options</label>
            
            <div className="flex items-center gap-3">
              <label className="font-body text-sm text-pencil dark:text-pencil-dark">Student name:</label>
              <input
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Optional..."
                className="font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-3 py-1 outline-none flex-1"
                style={{ borderRadius: wobbly }}
              />
            </div>

            <label className="flex items-center gap-2 font-body text-sm cursor-pointer">
              <input type="checkbox" checked={includeDate} onChange={(e) => setIncludeDate(e.target.checked)} className="w-4 h-4" />
              Include date
            </label>

            <label className="flex items-center gap-2 font-body text-sm cursor-pointer">
              <input type="checkbox" checked={includeContext} onChange={(e) => setIncludeContext(e.target.checked)} className="w-4 h-4" />
              Include context sentences
            </label>
          </div>

          {/* Preview count */}
          <div className="flex items-center justify-between border-t border-pencil/10 pt-4">
            <span className="font-body text-sm text-pencil/50">
              {filteredEntries.length} word{filteredEntries.length !== 1 ? 's' : ''} will be exported
            </span>
            <button
              onClick={handleExport}
              disabled={filteredEntries.length === 0}
              className="flex items-center gap-2 font-body text-base px-6 py-2 border-2 border-pencil dark:border-pencil-dark bg-postit hover:bg-marker hover:text-white transition-colors disabled:opacity-40"
              style={{ borderRadius: wobbly }}
            >
              <Download size={16} strokeWidth={2.5} />
              Export {format.toUpperCase()}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function generatePrintHTML(
  entries: VocabularyEntry[],
  studentName: string,
  date: string,
  includeContext: boolean,
): string {
  const rows = entries.map((e, i) => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #ddd;font-family:serif;color:#666;">${i + 1}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #ddd;font-weight:bold;font-family:'Georgia',serif;">${e.word}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #ddd;color:#2d5da1;font-family:'Georgia',serif;">${e.translation}</td>
      ${includeContext ? `<td style="padding:6px 12px;border-bottom:1px solid #ddd;font-style:italic;color:#888;font-size:0.9em;font-family:serif;">${e.contextSentence || ''}</td>` : ''}
      <td style="padding:6px 12px;border-bottom:1px solid #ddd;color:#999;font-size:0.85em;font-family:serif;">${e.tags.join(', ')}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <title>Vocabulary - ${studentName || 'Wordly'}</title>
  <style>
    @page { margin: 2cm; }
    body { font-family: 'Georgia', serif; color: #2d2d2d; line-height: 1.6; }
    h1 { font-size: 28px; margin-bottom: 4px; border-bottom: 3px solid #2d2d2d; padding-bottom: 8px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 8px 12px; border-bottom: 2px solid #2d2d2d; font-weight: bold; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; color: #555; }
  </style>
</head>
<body>
  <h1>📝 Vocabulary List</h1>
  <div class="meta">
    ${studentName ? `<strong>Student:</strong> ${studentName}<br>` : ''}
    <strong>Date:</strong> ${date}<br>
    <strong>Words:</strong> ${entries.length}
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Word</th>
        <th>Translation</th>
        ${includeContext ? '<th>Context</th>' : ''}
        <th>Tags</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`
}
