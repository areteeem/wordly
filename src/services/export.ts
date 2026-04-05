import type { VocabularyEntry } from '../types'

export function exportCSV(
  entries: VocabularyEntry[],
  delimiter = ',',
  columns: (keyof VocabularyEntry)[] = ['word', 'translation', 'contextSentence', 'notes', 'tags'],
): string {
  const header = columns.join(delimiter)
  const rows = entries.map((e) =>
    columns
      .map((col) => {
        const val = e[col]
        const str = Array.isArray(val) ? val.join('; ') : String(val ?? '')
        // Escape delimiter and quotes
        if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      })
      .join(delimiter),
  )
  return [header, ...rows].join('\n')
}

export function exportTable(entries: VocabularyEntry[]): string {
  if (entries.length === 0) return ''
  const header = '| Word | Translation | Context | Notes | Tags |'
  const sep = '|------|-------------|---------|-------|------|'
  const rows = entries.map(
    (e) =>
      `| ${e.word} | ${e.translation} | ${e.contextSentence} | ${e.notes} | ${e.tags.join(', ')} |`,
  )
  return [header, sep, ...rows].join('\n')
}

export function exportText(entries: VocabularyEntry[], format: 'clean' | 'expanded' = 'clean'): string {
  if (format === 'clean') {
    return entries.map((e) => `${e.word} — ${e.translation}`).join('\n')
  }
  return entries
    .map(
      (e) =>
        `Word: ${e.word}\nTranslation: ${e.translation}\nContext: ${e.contextSentence}\nNotes: ${e.notes}\n`,
    )
    .join('\n')
}

export function downloadFile(content: string, filename: string, mime = 'text/csv') {
  const blob = new Blob(['\uFEFF' + content], { type: `${mime};charset=utf-8` })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
