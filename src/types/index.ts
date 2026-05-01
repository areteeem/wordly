// ── Core Data Types ──

export type VocabularyMastery = 'learning' | 'familiar' | 'mastered'
export type VocabularyEntryKind = 'word' | 'phrase'
export type TranslationSource = 'google' | 'mymemory' | 'manual' | 'none'
export type FlashcardCardType = 'word_to_meaning' | 'meaning_to_word' | 'context_to_word'
export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy'

export interface VocabularyOccurrence {
  id: string
  documentId: string
  contextSentence: string
  positionInDoc: number
  capturedText: string
  createdAt: number
  updatedAt: number
}

export interface VocabularySrsState {
  easeFactor: number
  intervalDays: number
  repetition: number
  dueAt: number
  lastReviewedAt: number | null
  reviewCount: number
  lapses: number
}

export interface VocabularyReviewEvent {
  id: string
  cardType: FlashcardCardType
  grade: ReviewGrade
  reviewedAt: number
  dueAt: number
  strengthAfter: number
}

export interface VocabularyRelations {
  semanticGroup: string | null
  synonyms: string[]
  antonyms: string[]
}

export interface VocabularyEntry {
  id: string
  word: string
  normalizedWord: string
  kind: VocabularyEntryKind
  translation: string
  translationSource: TranslationSource
  contextSentence: string
  notes: string
  tags: string[]
  positionInDoc: number
  documentId: string
  occurrences: VocabularyOccurrence[]
  starred: boolean
  mastery: VocabularyMastery
  strengthScore: number
  difficultyScore: number
  frequencyScore: number
  mistakeCount: number
  srs: VocabularySrsState
  relations: VocabularyRelations
  reviewHistory: VocabularyReviewEvent[]
  version: number
  lastSyncedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface VocabularyEntryInput {
  word: string
  translation: string
  contextSentence: string
  notes: string
  tags: string[]
  positionInDoc: number
  documentId: string
  translationSource?: TranslationSource
}

export interface FlashcardPrompt {
  id: string
  entryId: string
  type: FlashcardCardType
  prompt: string
  answer: string
  exampleSentence: string
  dueAt: number
  strengthScore: number
  difficultyScore: number
}

export interface VocabularySnapshot {
  schemaVersion: number
  version: number
  updatedAt: number
  deviceId: string
  entries: VocabularyEntry[]
}

export interface Document {
  id: string
  title: string
  content: string // HTML from TipTap
  folderId: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

export interface Folder {
  id: string
  name: string
  parentId: string | null
  createdAt: number
}

export interface DocumentTemplate {
  id: string
  name: string
  content: string
  tags: string[]
  createdAt: number
}

// ── Settings ──

export type ThemeMode = 'light' | 'dark' | 'neutral'
export type UIDensity = 'compact' | 'comfortable'
export type VocabViewMode = 'table' | 'cards' | 'compact' | 'flashcards'
export type ExportFormat = 'csv' | 'table' | 'text'
export type HighlightBehavior = 'selection' | 'click'
export type VocabScope = 'file' | 'folder' | 'all'

export interface AppSettings {
  theme: ThemeMode
  accentColor: string
  highlightColor: string
  fontFamily: string
  fontSize: number
  density: UIDensity
  autoSave: boolean
  highlightBehavior: HighlightBehavior
  defaultViewMode: VocabViewMode
  languageDetection: boolean
  autoAddOnHighlight: boolean
  requireConfirmation: boolean
  autoAcceptTranslation: boolean
  defaultTags: string[]
  defaultExportFormat: ExportFormat
  csvDelimiter: string
  translateTo: string
  translateFrom: string
  vocabScope: VocabScope
  leftPanelWidth: number
  rightPanelWidth: number
  dailyGoal: number
  vocabFullScreen: boolean
  highlightPopupEnabled: boolean
  highlightPopupDelay: number
  revealTranslation: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  accentColor: '#ff4d4d',
  highlightColor: '#a8d8ea',
  fontFamily: 'Patrick Hand',
  fontSize: 18,
  density: 'comfortable',
  autoSave: true,
  highlightBehavior: 'selection',
  defaultViewMode: 'table',
  languageDetection: true,
  autoAddOnHighlight: false,
  requireConfirmation: true,
  autoAcceptTranslation: false,
  defaultTags: [],
  defaultExportFormat: 'csv',
  csvDelimiter: ',',
  translateTo: 'en',
  translateFrom: 'auto',
  vocabScope: 'file',
  leftPanelWidth: 260,
  rightPanelWidth: 320,
  dailyGoal: 10,
  vocabFullScreen: false,
  highlightPopupEnabled: true,
  highlightPopupDelay: 1000,
  revealTranslation: true,
}

export const LANGUAGES = [
  { code: 'auto', name: 'Auto-detect' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'tr', name: 'Turkish' },
  { code: 'pl', name: 'Polish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'sv', name: 'Swedish' },
  { code: 'cs', name: 'Czech' },
]

// ── UI State ──

export interface Notification {
  id: string
  message: string
  type: 'success' | 'info' | 'error'
}

export const INBOX_FOLDER_ID = 'inbox'
