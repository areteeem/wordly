import { useMemo, useState } from 'react'
import { X, Download, FileText, FolderOpen, Tag, Check, Settings2 } from 'lucide-react'
import { useVocabularyStore } from '../../stores/vocabularyStore'
import { useDocumentStore } from '../../stores/documentStore'
import { useFolderStore } from '../../stores/folderStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { exportCSV, exportTable, exportText, downloadFile } from '../../services/export'
import { wobbly, wobblyMd } from '../../lib/utils'
import type { VocabularyEntry } from '../../types'

type ExportScope = 'all' | 'folder' | 'tag' | 'document' | 'selected'
type ExportFormatChoice = 'csv' | 'table' | 'text' | 'anki' | 'pdf' | 'doc-pdf' | 'combined-pdf'
type MarkerMode = 'none' | 'line' | 'word'
type DocumentLayout = 'rich' | 'study'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
}

const FORMAT_OPTIONS: Array<{ fmt: ExportFormatChoice; label: string; description: string }> = [
  { fmt: 'csv', label: 'CSV', description: 'Spreadsheet-friendly vocabulary export.' },
  { fmt: 'text', label: 'Text', description: 'Plain text list with optional context.' },
  { fmt: 'table', label: 'Markdown Table', description: 'Copy a table to the clipboard.' },
  { fmt: 'anki', label: 'Anki Deck', description: 'Tab-separated front and back cards.' },
  { fmt: 'pdf', label: 'Vocabulary PDF', description: 'Printable vocabulary handout.' },
  { fmt: 'doc-pdf', label: 'Document PDF', description: 'Print the selected document with study markers.' },
  { fmt: 'combined-pdf', label: 'Document + Words', description: 'Document text followed by a vocabulary section.' },
]

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const entries = useVocabularyStore((s) => s.entries)
  const documents = useDocumentStore((s) => s.documents)
  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)
  const folders = useFolderStore((s) => s.folders)
  const notify = useSettingsStore((s) => s.notify)
  const csvDelimiter = useSettingsStore((s) => s.settings.csvDelimiter)

  const [exportScope, setExportScope] = useState<ExportScope>('all')
  const [selectedFolderId, setSelectedFolderId] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [selectedDocId, setSelectedDocId] = useState('')
  const [format, setFormat] = useState<ExportFormatChoice>('csv')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(entries.map((entry) => entry.id)))
  const [studentName, setStudentName] = useState('')
  const [includeDate, setIncludeDate] = useState(true)
  const [includeContext, setIncludeContext] = useState(true)
  const [includeTags, setIncludeTags] = useState(true)
  const [documentLayout, setDocumentLayout] = useState<DocumentLayout>('rich')
  const [markerMode, setMarkerMode] = useState<MarkerMode>('none')
  const [markerInterval, setMarkerInterval] = useState(5)

  const allTags = useMemo(() => {
    const tags = new Map<string, number>()
    entries.forEach((entry) => entry.tags.forEach((tag) => tags.set(tag, (tags.get(tag) || 0) + 1)))
    return Array.from(tags.entries())
  }, [entries])

  const resolvedDocumentId = selectedDocId || activeDocumentId || ''
  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.id === resolvedDocumentId) ?? null,
    [documents, resolvedDocumentId],
  )

  const filteredEntries = useMemo(() => {
    let result = entries

    if (exportScope === 'folder' && selectedFolderId) {
      const docIds = documents.filter((doc) => doc.folderId === selectedFolderId).map((doc) => doc.id)
      result = result.filter((entry) => docIds.includes(entry.documentId))
    } else if (exportScope === 'tag' && selectedTag) {
      result = result.filter((entry) => entry.tags.includes(selectedTag))
    } else if (exportScope === 'document' && resolvedDocumentId) {
      result = result.filter((entry) => entry.documentId === resolvedDocumentId)
    } else if (exportScope === 'selected') {
      result = result.filter((entry) => selectedIds.has(entry.id))
    }

    return result
  }, [documents, entries, exportScope, resolvedDocumentId, selectedFolderId, selectedIds, selectedTag])

  const documentEntries = useMemo(
    () => (selectedDocument ? entries.filter((entry) => entry.documentId === selectedDocument.id) : []),
    [entries, selectedDocument],
  )

  const previewEntries =
    format === 'combined-pdf'
      ? filteredEntries.length > 0
        ? filteredEntries
        : documentEntries
      : filteredEntries

  const canExport =
    format === 'doc-pdf'
      ? Boolean(selectedDocument)
      : format === 'combined-pdf'
        ? Boolean(selectedDocument)
        : filteredEntries.length > 0

  const toggleSelectEntry = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleExport = () => {
    if (!canExport) {
      notify('Pick a valid export target before exporting', 'info')
      return
    }

    const dateStr = new Date().toLocaleDateString()
    const namePrefix = studentName ? `${studentName} - ` : ''

    switch (format) {
      case 'csv': {
        downloadFile(exportCSV(filteredEntries, csvDelimiter), `${namePrefix}vocabulary.csv`)
        break
      }
      case 'table': {
        navigator.clipboard.writeText(exportTable(filteredEntries))
        notify('Table copied to clipboard!')
        onClose()
        return
      }
      case 'text': {
        let content = ''
        if (studentName) content += `Student: ${studentName}\n`
        if (includeDate) content += `Date: ${dateStr}\n`
        if (content) content += `Words: ${filteredEntries.length}\n\n`
        content += exportText(filteredEntries, includeContext ? 'expanded' : 'clean')
        downloadFile(content, `${namePrefix}vocabulary.txt`, 'text/plain')
        break
      }
      case 'anki': {
        const anki = filteredEntries
          .map((entry) => `${entry.word}\t${entry.translation}${entry.contextSentence ? `<br><i>${entry.contextSentence}</i>` : ''}`)
          .join('\n')
        downloadFile(anki, `${namePrefix}anki-deck.txt`, 'text/plain')
        break
      }
      case 'pdf': {
        openPrintWindow(
          generateVocabularyPrintHTML({
            entries: filteredEntries,
            studentName,
            date: dateStr,
            includeContext,
            includeTags,
            includeDate,
          }),
        )
        break
      }
      case 'doc-pdf': {
        if (!selectedDocument) return
        openPrintWindow(
          generateDocumentPrintHTML({
            title: selectedDocument.title,
            content: selectedDocument.content,
            studentName,
            date: dateStr,
            includeDate,
            layout: documentLayout,
            markerMode,
            markerInterval,
          }),
        )
        break
      }
      case 'combined-pdf': {
        if (!selectedDocument) return
        openPrintWindow(
          generateCombinedPrintHTML({
            title: selectedDocument.title,
            content: selectedDocument.content,
            entries: previewEntries,
            studentName,
            date: dateStr,
            includeDate,
            includeContext,
            includeTags,
            layout: documentLayout,
            markerMode,
            markerInterval,
          }),
        )
        break
      }
    }

    notify('Export prepared')
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-pencil/20 dark:bg-black/40" onClick={onClose} />
      <div
        className="relative bg-paper dark:bg-paper-dark border-[3px] border-pencil dark:border-pencil-dark w-full max-w-3xl max-h-[88vh] overflow-y-auto shadow-hard-lg dark:shadow-hard-lg-dark animate-pop-in z-50"
        style={{ borderRadius: wobblyMd }}
      >
        <div className="flex items-center justify-between p-5 border-b-2 border-dashed border-pencil/20 dark:border-pencil-dark/20">
          <div className="flex items-center gap-2" style={{ transform: 'rotate(-1deg)' }}>
            <Download size={24} strokeWidth={2.5} className="text-pencil dark:text-pencil-dark" />
            <h2 className="font-heading text-3xl text-pencil dark:text-pencil-dark">Export</h2>
          </div>
          <button onClick={onClose} className="text-pencil/60 hover:text-marker">
            <X size={24} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <section className="space-y-3">
            <label className="font-heading text-lg text-pencil dark:text-pencil-dark block">Scope</label>
            <div className="flex flex-wrap gap-2">
              {[
                { scope: 'all' as const, label: 'All Words', icon: FileText },
                { scope: 'folder' as const, label: 'Folder', icon: FolderOpen },
                { scope: 'tag' as const, label: 'Tag', icon: Tag },
                { scope: 'document' as const, label: 'Document', icon: FileText },
                { scope: 'selected' as const, label: 'Selected Words', icon: Check },
              ].map(({ scope, label, icon: Icon }) => (
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
                  <Icon size={14} strokeWidth={2.5} />
                  {label}
                </button>
              ))}
            </div>

            {exportScope === 'folder' && (
              <select
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="w-full font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-3 py-2 outline-none"
                style={{ borderRadius: wobbly }}
              >
                <option value="">Select folder...</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                ))}
              </select>
            )}

            {exportScope === 'tag' && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-3 py-2 outline-none"
                style={{ borderRadius: wobbly }}
              >
                <option value="">Select tag...</option>
                {allTags.map(([tag, count]) => (
                  <option key={tag} value={tag}>{tag} ({count})</option>
                ))}
              </select>
            )}

            {(exportScope === 'document' || format === 'doc-pdf' || format === 'combined-pdf') && (
              <select
                value={resolvedDocumentId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="w-full font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-3 py-2 outline-none"
                style={{ borderRadius: wobbly }}
              >
                <option value="">Select document...</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>{doc.title || 'Untitled'}</option>
                ))}
              </select>
            )}

            {exportScope === 'selected' && (
              <div className="max-h-[200px] overflow-y-auto border-2 border-pencil/20 p-2 space-y-0.5" style={{ borderRadius: wobbly }}>
                <label className="flex items-center gap-2 font-body text-xs text-pencil/50 mb-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === entries.length}
                    onChange={() => {
                      if (selectedIds.size === entries.length) setSelectedIds(new Set())
                      else setSelectedIds(new Set(entries.map((entry) => entry.id)))
                    }}
                    className="w-3.5 h-3.5"
                  />
                  Select all ({entries.length})
                </label>
                {entries.map((entry) => (
                  <label key={entry.id} className="flex items-center gap-2 font-body text-sm cursor-pointer hover:bg-erased/30 px-1 py-0.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(entry.id)}
                      onChange={() => toggleSelectEntry(entry.id)}
                      className="w-3.5 h-3.5"
                    />
                    <span className="font-bold text-pencil dark:text-pencil-dark">{entry.word}</span>
                    <span className="text-pen dark:text-blue-300">— {entry.translation}</span>
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <label className="font-heading text-lg text-pencil dark:text-pencil-dark block">Format</label>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {FORMAT_OPTIONS.map(({ fmt, label, description }) => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  className={`border-2 p-3 text-left transition-colors ${
                    format === fmt
                      ? 'border-pencil bg-postit dark:border-pencil-dark dark:bg-erased-dark'
                      : 'border-pencil/20 bg-white hover:bg-erased/40 dark:border-pencil-dark/20 dark:bg-paper-dark dark:hover:bg-erased-dark/40'
                  }`}
                  style={{ borderRadius: wobblyMd }}
                >
                  <div className="font-heading text-lg text-pencil dark:text-pencil-dark">{label}</div>
                  <div className="font-body text-sm text-pencil/55 dark:text-pencil-dark/55">{description}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Settings2 size={18} strokeWidth={2.5} className="text-pencil dark:text-pencil-dark" />
              <label className="font-heading text-lg text-pencil dark:text-pencil-dark block">Options</label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3 border border-pencil/15 p-3" style={{ borderRadius: wobblyMd }}>
                <label className="font-body text-sm text-pencil dark:text-pencil-dark block">
                  Student name
                </label>
                <input
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Optional..."
                  className="w-full font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-3 py-1.5 outline-none"
                  style={{ borderRadius: wobbly }}
                />

                <label className="flex items-center gap-2 font-body text-sm cursor-pointer">
                  <input type="checkbox" checked={includeDate} onChange={(e) => setIncludeDate(e.target.checked)} className="w-4 h-4" />
                  Include date
                </label>
                <label className="flex items-center gap-2 font-body text-sm cursor-pointer">
                  <input type="checkbox" checked={includeContext} onChange={(e) => setIncludeContext(e.target.checked)} className="w-4 h-4" />
                  Include context sentences
                </label>
                <label className="flex items-center gap-2 font-body text-sm cursor-pointer">
                  <input type="checkbox" checked={includeTags} onChange={(e) => setIncludeTags(e.target.checked)} className="w-4 h-4" />
                  Include tags in vocabulary export
                </label>
              </div>

              <div className="space-y-3 border border-pencil/15 p-3" style={{ borderRadius: wobblyMd }}>
                <div className="font-body text-sm text-pencil dark:text-pencil-dark">Preview</div>
                <div className="font-heading text-xl text-pencil dark:text-pencil-dark">
                  {format === 'doc-pdf' || format === 'combined-pdf'
                    ? selectedDocument?.title || 'No document selected'
                    : `${filteredEntries.length} words`}
                </div>
                <div className="font-body text-sm text-pencil/55 dark:text-pencil-dark/55">
                  {format === 'combined-pdf'
                    ? `${previewEntries.length} vocabulary items will be attached to the document.`
                    : format === 'doc-pdf'
                      ? 'The exported PDF will use the selected document content.'
                      : `The current selection will export ${filteredEntries.length} vocabulary entries.`}
                </div>
              </div>
            </div>

            {(format === 'doc-pdf' || format === 'combined-pdf') && (
              <div className="space-y-3 border border-pencil/15 p-3" style={{ borderRadius: wobblyMd }}>
                <div className="font-body text-sm text-pencil dark:text-pencil-dark">Document study setup</div>

                <div className="flex flex-wrap gap-2">
                  {(['rich', 'study'] as DocumentLayout[]).map((layout) => (
                    <button
                      key={layout}
                      onClick={() => setDocumentLayout(layout)}
                      className={`px-3 py-1.5 font-body text-sm border-2 border-pencil dark:border-pencil-dark transition-colors ${
                        documentLayout === layout
                          ? 'bg-pencil text-white dark:bg-pencil-dark dark:text-paper-dark'
                          : 'bg-white dark:bg-paper-dark hover:bg-erased'
                      }`}
                      style={{ borderRadius: wobbly }}
                    >
                      {layout === 'rich' ? 'Original layout' : 'Study layout'}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {(['none', 'line', 'word'] as MarkerMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setMarkerMode(mode)}
                      className={`px-3 py-1.5 font-body text-sm border-2 border-pencil dark:border-pencil-dark transition-colors ${
                        markerMode === mode
                          ? 'bg-pencil text-white dark:bg-pencil-dark dark:text-paper-dark'
                          : 'bg-white dark:bg-paper-dark hover:bg-erased'
                      }`}
                      style={{ borderRadius: wobbly }}
                    >
                      {mode === 'none' ? 'No markers' : mode === 'line' ? 'Line markers' : 'Word markers'}
                    </button>
                  ))}
                </div>

                {markerMode !== 'none' && (
                  <div className="flex flex-wrap gap-2">
                    {[1, 5, 10].map((interval) => (
                      <button
                        key={interval}
                        onClick={() => setMarkerInterval(interval)}
                        className={`px-3 py-1.5 font-body text-sm border-2 border-pencil dark:border-pencil-dark transition-colors ${
                          markerInterval === interval
                            ? 'bg-postit text-pencil dark:bg-erased-dark dark:text-pencil-dark'
                            : 'bg-white dark:bg-paper-dark hover:bg-erased'
                        }`}
                        style={{ borderRadius: wobbly }}
                      >
                        Every {interval}
                      </button>
                    ))}
                  </div>
                )}

                <p className="font-body text-xs text-pencil/50 dark:text-pencil-dark/50">
                  Marker-enabled exports automatically use the study-sheet renderer so markers stay consistent on the printed page.
                </p>
              </div>
            )}
          </section>

          <div className="flex items-center justify-between border-t border-pencil/10 pt-4 gap-4">
            <span className="font-body text-sm text-pencil/50">
              {canExport
                ? format === 'combined-pdf'
                  ? `${previewEntries.length} vocabulary items will be exported with the document`
                  : format === 'doc-pdf'
                    ? 'Document export is ready'
                    : `${filteredEntries.length} word${filteredEntries.length !== 1 ? 's' : ''} will be exported`
                : 'Choose a valid export target'}
            </span>
            <button
              onClick={handleExport}
              disabled={!canExport}
              className="flex items-center gap-2 font-body text-base px-6 py-2 border-2 border-pencil dark:border-pencil-dark bg-postit hover:bg-marker hover:text-white transition-colors disabled:opacity-40"
              style={{ borderRadius: wobbly }}
            >
              <Download size={16} strokeWidth={2.5} />
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function openPrintWindow(html: string) {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  window.setTimeout(() => win.print(), 500)
}

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function extractStudyLines(content: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(content, 'text/html')
  const blocks = Array.from(doc.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre'))
    .map((element) => (element.textContent || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const baseBlocks = blocks.length > 0 ? blocks : [(doc.body.textContent || '').replace(/\s+/g, ' ').trim()].filter(Boolean)
  return baseBlocks.flatMap((block) => wrapTextByWords(block, 12))
}

function wrapTextByWords(text: string, wordsPerLine: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []

  for (let index = 0; index < words.length; index += wordsPerLine) {
    lines.push(words.slice(index, index + wordsPerLine).join(' '))
  }

  return lines
}

function renderDocumentBody(content: string, layout: DocumentLayout, markerMode: MarkerMode, markerInterval: number) {
  if (layout === 'rich' && markerMode === 'none') {
    return `<div class="doc-content">${content}</div>`
  }

  const lines = extractStudyLines(content)
  let globalWordCount = 0

  const renderedLines = lines.map((line, index) => {
    if (markerMode === 'word') {
      const wordHtml = line
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => {
          globalWordCount += 1
          const marker =
            globalWordCount % markerInterval === 0
              ? `<span class="marker-chip">${globalWordCount}</span>`
              : ''
          return `<span>${escapeHtml(word)}</span>${marker}`
        })
        .join(' ')

      return `<div class="study-line"><span class="marker-slot"></span><span class="study-text">${wordHtml}</span></div>`
    }

    const lineMarker =
      markerMode === 'line' && ((index + 1) % markerInterval === 0 || markerInterval === 1)
        ? `<span class="marker-chip">${index + 1}</span>`
        : '<span class="marker-slot"></span>'

    return `<div class="study-line">${lineMarker}<span class="study-text">${escapeHtml(line)}</span></div>`
  })

  return `<div class="study-sheet">${renderedLines.join('')}</div>`
}

function generateVocabularyPrintHTML({
  entries,
  studentName,
  date,
  includeContext,
  includeTags,
  includeDate,
}: {
  entries: VocabularyEntry[]
  studentName: string
  date: string
  includeContext: boolean
  includeTags: boolean
  includeDate: boolean
}) {
  const rows = entries
    .map(
      (entry, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(entry.word)}</td>
          <td>${escapeHtml(entry.translation)}</td>
          ${includeContext ? `<td>${escapeHtml(entry.contextSentence || '')}</td>` : ''}
          ${includeTags ? `<td>${escapeHtml(entry.tags.join(', '))}</td>` : ''}
        </tr>
      `,
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
  <title>Vocabulary Export</title>
  <style>
    ${basePrintStyles()}
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #ddd; }
    th { border-bottom: 2px solid #2d2d2d; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; color: #555; }
  </style>
</head>
<body>
  <h1>Vocabulary List</h1>
  <div class="meta">
    ${studentName ? `<strong>Student:</strong> ${escapeHtml(studentName)}<br>` : ''}
    ${includeDate ? `<strong>Date:</strong> ${date}<br>` : ''}
    <strong>Words:</strong> ${entries.length}
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Word</th>
        <th>Translation</th>
        ${includeContext ? '<th>Context</th>' : ''}
        ${includeTags ? '<th>Tags</th>' : ''}
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`
}

function generateDocumentPrintHTML({
  title,
  content,
  studentName,
  date,
  includeDate,
  layout,
  markerMode,
  markerInterval,
}: {
  title: string
  content: string
  studentName: string
  date: string
  includeDate: boolean
  layout: DocumentLayout
  markerMode: MarkerMode
  markerInterval: number
}) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(title || 'Document')}</title>
  <style>
    ${basePrintStyles()}
    ${documentPrintStyles()}
  </style>
</head>
<body>
  <h1>${escapeHtml(title || 'Untitled Document')}</h1>
  <div class="meta">
    ${studentName ? `<strong>Student:</strong> ${escapeHtml(studentName)}<br>` : ''}
    ${includeDate ? `<strong>Date:</strong> ${date}` : ''}
  </div>
  ${renderDocumentBody(content, layout, markerMode, markerInterval)}
</body>
</html>`
}

function generateCombinedPrintHTML({
  title,
  content,
  entries,
  studentName,
  date,
  includeDate,
  includeContext,
  includeTags,
  layout,
  markerMode,
  markerInterval,
}: {
  title: string
  content: string
  entries: VocabularyEntry[]
  studentName: string
  date: string
  includeDate: boolean
  includeContext: boolean
  includeTags: boolean
  layout: DocumentLayout
  markerMode: MarkerMode
  markerInterval: number
}) {
  const vocabRows = entries
    .map(
      (entry, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(entry.word)}</td>
          <td>${escapeHtml(entry.translation)}</td>
          ${includeContext ? `<td>${escapeHtml(entry.contextSentence || '')}</td>` : ''}
          ${includeTags ? `<td>${escapeHtml(entry.tags.join(', '))}</td>` : ''}
        </tr>
      `,
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(title || 'Document')}</title>
  <style>
    ${basePrintStyles()}
    ${documentPrintStyles()}
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #ddd; }
    th { border-bottom: 2px solid #2d2d2d; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; color: #555; }
    .vocab-section { page-break-before: always; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title || 'Untitled Document')}</h1>
  <div class="meta">
    ${studentName ? `<strong>Student:</strong> ${escapeHtml(studentName)}<br>` : ''}
    ${includeDate ? `<strong>Date:</strong> ${date}<br>` : ''}
    <strong>Words attached:</strong> ${entries.length}
  </div>
  ${renderDocumentBody(content, layout, markerMode, markerInterval)}
  <div class="vocab-section">
    <h2>Vocabulary</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Word</th>
          <th>Translation</th>
          ${includeContext ? '<th>Context</th>' : ''}
          ${includeTags ? '<th>Tags</th>' : ''}
        </tr>
      </thead>
      <tbody>${vocabRows}</tbody>
    </table>
  </div>
</body>
</html>`
}

function basePrintStyles() {
  return `
    @page { margin: 1.8cm; }
    body { font-family: 'Georgia', serif; color: #2d2d2d; line-height: 1.7; max-width: 860px; margin: 0 auto; }
    h1 { font-size: 28px; margin-bottom: 4px; border-bottom: 3px solid #2d2d2d; padding-bottom: 8px; }
    h2 { font-size: 22px; margin: 28px 0 16px; border-bottom: 2px solid #2d2d2d; padding-bottom: 6px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
  `
}

function documentPrintStyles() {
  return `
    .doc-content { font-size: 16px; }
    .doc-content h1 { font-size: 24px; border-bottom: none; }
    .doc-content h2 { font-size: 20px; }
    .doc-content h3 { font-size: 18px; }
    .doc-content blockquote { border-left: 4px solid #2d5da1; padding: 8px 16px; margin: 16px 0; font-style: italic; background: #f5f5f5; }
    .doc-content pre { background: #f4f4f4; padding: 12px; border: 1px solid #ddd; font-family: monospace; font-size: 14px; overflow-x: auto; }
    .doc-content code { background: #f0f0f0; padding: 2px 5px; font-family: monospace; font-size: 0.9em; }
    .doc-content img { max-width: 100%; height: auto; }
    .doc-content hr { border: none; border-top: 2px dashed #ccc; margin: 24px 0; }
    .doc-content mark { background-color: #fff3a3; padding: 2px 4px; }
    .study-sheet { display: flex; flex-direction: column; gap: 8px; }
    .study-line { display: grid; grid-template-columns: 48px 1fr; align-items: start; gap: 12px; min-height: 28px; }
    .marker-chip { display: inline-flex; align-items: center; justify-content: center; min-width: 32px; padding: 4px 8px; border: 1px solid #2d5da1; color: #2d5da1; font-size: 12px; border-radius: 999px; }
    .marker-slot { display: inline-block; min-height: 1px; }
    .study-text { font-size: 16px; line-height: 1.8; }
  `
}