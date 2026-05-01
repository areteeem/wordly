import type {
  FlashcardCardType,
  FlashcardPrompt,
  ReviewGrade,
  VocabularyEntry,
  VocabularyEntryInput,
  VocabularyMastery,
  VocabularyOccurrence,
  VocabularyRelations,
  VocabularyReviewEvent,
  VocabularySnapshot,
  VocabularySrsState,
} from '../types'
import { now, uid } from './utils'

export const VOCABULARY_SCHEMA_VERSION = 2

const DEFAULT_RELATIONS: VocabularyRelations = {
  semanticGroup: null,
  synonyms: [],
  antonyms: [],
}

const DEFAULT_SRS = (timestamp: number): VocabularySrsState => ({
  easeFactor: 2.5,
  intervalDays: 0,
  repetition: 0,
  dueAt: timestamp,
  lastReviewedAt: null,
  reviewCount: 0,
  lapses: 0,
})

const REVIEW_QUALITY: Record<ReviewGrade, number> = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
}

const REVIEW_CARD_ORDER: FlashcardCardType[] = [
  'word_to_meaning',
  'meaning_to_word',
  'context_to_word',
]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function sanitizeVocabularyText(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function sanitizeVocabularyTags(tags: string[]): string[] {
  return Array.from(
    new Set(tags.map((tag) => sanitizeVocabularyText(tag)).filter(Boolean)),
  )
}

export function normalizeVocabularyWord(value: string): string {
  const normalized = sanitizeVocabularyText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/[^\p{L}\p{N}' -]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized
}

export function detectVocabularyKind(value: string): VocabularyEntry['kind'] {
  return /\s/.test(sanitizeVocabularyText(value)) ? 'phrase' : 'word'
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildOccurrenceSignature(occurrence: VocabularyOccurrence): string {
  return [
    occurrence.documentId,
    occurrence.positionInDoc,
    normalizeVocabularyWord(occurrence.capturedText || occurrence.contextSentence),
  ].join('::')
}

function mergeOccurrences(occurrences: VocabularyOccurrence[]): VocabularyOccurrence[] {
  const merged = new Map<string, VocabularyOccurrence>()

  for (const rawOccurrence of occurrences) {
    const occurrence: VocabularyOccurrence = {
      id: rawOccurrence.id || uid(),
      documentId: rawOccurrence.documentId || '',
      contextSentence: sanitizeVocabularyText(rawOccurrence.contextSentence || ''),
      positionInDoc: Math.max(0, rawOccurrence.positionInDoc || 0),
      capturedText: sanitizeVocabularyText(rawOccurrence.capturedText || ''),
      createdAt: rawOccurrence.createdAt || rawOccurrence.updatedAt || now(),
      updatedAt: rawOccurrence.updatedAt || rawOccurrence.createdAt || now(),
    }

    const signature = buildOccurrenceSignature(occurrence)
    const current = merged.get(signature)
    if (!current || occurrence.updatedAt >= current.updatedAt) {
      merged.set(signature, occurrence)
    }
  }

  return Array.from(merged.values()).sort((left, right) => right.updatedAt - left.updatedAt)
}

function mergeReviewHistory(history: VocabularyReviewEvent[]): VocabularyReviewEvent[] {
  const merged = new Map<string, VocabularyReviewEvent>()

  for (const event of history) {
    const candidate: VocabularyReviewEvent = {
      id: event.id || uid(),
      cardType: event.cardType,
      grade: event.grade,
      reviewedAt: event.reviewedAt,
      dueAt: event.dueAt,
      strengthAfter: clamp(event.strengthAfter, 0, 100),
    }
    const existing = merged.get(candidate.id)
    if (!existing || candidate.reviewedAt >= existing.reviewedAt) {
      merged.set(candidate.id, candidate)
    }
  }

  return Array.from(merged.values())
    .sort((left, right) => right.reviewedAt - left.reviewedAt)
    .slice(0, 30)
}

function pickPrimaryOccurrence(entry: Partial<VocabularyEntry>, occurrences: VocabularyOccurrence[]) {
  return occurrences[0] ?? {
    id: uid(),
    documentId: entry.documentId || '',
    contextSentence: sanitizeVocabularyText(entry.contextSentence || ''),
    positionInDoc: Math.max(0, entry.positionInDoc || 0),
    capturedText: sanitizeVocabularyText(entry.word || ''),
    createdAt: entry.createdAt || now(),
    updatedAt: entry.updatedAt || now(),
  }
}

function normalizeSrsState(entry: Partial<VocabularyEntry>, timestamp: number): VocabularySrsState {
  const srs = entry.srs
  if (!srs) {
    return DEFAULT_SRS(timestamp)
  }

  return {
    easeFactor: clamp(srs.easeFactor || 2.5, 1.3, 3.1),
    intervalDays: Math.max(0, Math.round(srs.intervalDays || 0)),
    repetition: Math.max(0, Math.round(srs.repetition || 0)),
    dueAt: srs.dueAt || timestamp,
    lastReviewedAt: srs.lastReviewedAt ?? null,
    reviewCount: Math.max(0, Math.round(srs.reviewCount || 0)),
    lapses: Math.max(0, Math.round(srs.lapses || 0)),
  }
}

function normalizeRelations(entry: Partial<VocabularyEntry>): VocabularyRelations {
  return {
    semanticGroup: entry.relations?.semanticGroup?.trim() || null,
    synonyms: sanitizeVocabularyTags(entry.relations?.synonyms || []),
    antonyms: sanitizeVocabularyTags(entry.relations?.antonyms || []),
  }
}

function computeStrengthScore(entry: Pick<VocabularyEntry, 'occurrences' | 'mistakeCount' | 'translation' | 'srs'>): number {
  const occurrenceBonus = Math.min(18, entry.occurrences.length * 4)
  const repetitionBonus = Math.min(36, entry.srs.repetition * 10)
  const easeBonus = Math.round((entry.srs.easeFactor - 1.3) * 14)
  const dueBonus = entry.srs.dueAt > now() ? 8 : 0
  const translationPenalty = entry.translation ? 0 : 12
  const mistakePenalty = Math.min(36, entry.mistakeCount * 8)

  return clamp(18 + occurrenceBonus + repetitionBonus + easeBonus + dueBonus - translationPenalty - mistakePenalty, 0, 100)
}

function deriveMastery(strengthScore: number, srs: VocabularySrsState): VocabularyMastery {
  if (strengthScore >= 75 || srs.repetition >= 5) return 'mastered'
  if (strengthScore >= 45 || srs.repetition >= 2) return 'familiar'
  return 'learning'
}

function computeDifficultyScore(entry: Pick<VocabularyEntry, 'kind' | 'word' | 'mistakeCount' | 'strengthScore'>): number {
  const termLength = normalizeVocabularyWord(entry.word).replace(/\s+/g, '').length
  const phrasePenalty = entry.kind === 'phrase' ? 14 : 0
  const mistakePenalty = Math.min(36, entry.mistakeCount * 9)
  const familiarityRelief = Math.round(entry.strengthScore * 0.35)

  return clamp(24 + Math.min(20, termLength) + phrasePenalty + mistakePenalty - familiarityRelief, 5, 100)
}

export function ensureVocabularyEntry(entry: Partial<VocabularyEntry>, timestamp = now()): VocabularyEntry {
  const word = sanitizeVocabularyText(entry.word || '')
  const normalizedWord = normalizeVocabularyWord(entry.normalizedWord || word)
  const kind = entry.kind || detectVocabularyKind(word)

  const baseOccurrences = entry.occurrences?.length
    ? entry.occurrences
    : [
        {
          id: uid(),
          documentId: entry.documentId || '',
          contextSentence: sanitizeVocabularyText(entry.contextSentence || ''),
          positionInDoc: Math.max(0, entry.positionInDoc || 0),
          capturedText: sanitizeVocabularyText(word),
          createdAt: entry.createdAt || timestamp,
          updatedAt: entry.updatedAt || timestamp,
        },
      ]

  const occurrences = mergeOccurrences(baseOccurrences)
  const primaryOccurrence = pickPrimaryOccurrence(entry, occurrences)
  const srs = normalizeSrsState(entry, timestamp)
  const translation = sanitizeVocabularyText(entry.translation || '')
  const notes = sanitizeVocabularyText(entry.notes || '')
  const mistakeCount = Math.max(0, Math.round(entry.mistakeCount || 0))
  const relations = normalizeRelations(entry)
  const reviewHistory = mergeReviewHistory(entry.reviewHistory || [])

  const provisionalEntry = {
    id: entry.id || uid(),
    word,
    normalizedWord,
    kind,
    translation,
    translationSource: entry.translationSource || (translation ? 'manual' : 'none'),
    contextSentence: primaryOccurrence.contextSentence,
    notes,
    tags: sanitizeVocabularyTags(entry.tags || []),
    positionInDoc: primaryOccurrence.positionInDoc,
    documentId: primaryOccurrence.documentId,
    occurrences,
    starred: Boolean(entry.starred),
    mistakeCount,
    srs,
    relations,
    reviewHistory,
    version: Math.max(1, Math.round(entry.version || 1)),
    lastSyncedAt: entry.lastSyncedAt ?? null,
    createdAt: entry.createdAt || timestamp,
    updatedAt: entry.updatedAt || timestamp,
  }

  const strengthScore = computeStrengthScore(provisionalEntry)
  const mastery = entry.mastery || deriveMastery(strengthScore, srs)
  const difficultyScore = computeDifficultyScore({
    kind,
    word,
    mistakeCount,
    strengthScore,
  })

  return {
    ...provisionalEntry,
    mastery,
    strengthScore,
    difficultyScore,
    frequencyScore: Math.max(entry.frequencyScore || 0, occurrences.length),
  }
}

export function mergeVocabularyEntries(leftEntry: VocabularyEntry, rightEntry: VocabularyEntry): VocabularyEntry {
  const left = ensureVocabularyEntry(leftEntry)
  const right = ensureVocabularyEntry(rightEntry)
  const winner = right.updatedAt >= left.updatedAt ? right : left
  const loser = winner === right ? left : right
  const mergedOccurrences = mergeOccurrences([...left.occurrences, ...right.occurrences])
  const mergedHistory = mergeReviewHistory([...left.reviewHistory, ...right.reviewHistory])
  const mergedSrs = winner.srs.lastReviewedAt && loser.srs.lastReviewedAt
    ? winner.srs.lastReviewedAt >= loser.srs.lastReviewedAt
      ? winner.srs
      : loser.srs
    : winner.srs.reviewCount >= loser.srs.reviewCount
      ? winner.srs
      : loser.srs

  return ensureVocabularyEntry({
    ...winner,
    translation: winner.translation || loser.translation,
    translationSource: winner.translation ? winner.translationSource : loser.translationSource,
    notes: winner.notes || loser.notes,
    tags: [...left.tags, ...right.tags],
    occurrences: mergedOccurrences,
    mistakeCount: Math.max(left.mistakeCount, right.mistakeCount),
    srs: mergedSrs,
    relations: {
      semanticGroup: winner.relations.semanticGroup || loser.relations.semanticGroup || null,
      synonyms: [...left.relations.synonyms, ...right.relations.synonyms],
      antonyms: [...left.relations.antonyms, ...right.relations.antonyms],
    },
    reviewHistory: mergedHistory,
    version: Math.max(left.version, right.version) + 1,
    createdAt: Math.min(left.createdAt, right.createdAt),
    updatedAt: Math.max(left.updatedAt, right.updatedAt),
    lastSyncedAt: Math.max(left.lastSyncedAt || 0, right.lastSyncedAt || 0) || null,
  })
}

export function normalizeVocabularyEntries(entries: Partial<VocabularyEntry>[]): VocabularyEntry[] {
  const deduped = new Map<string, VocabularyEntry>()

  for (const rawEntry of entries) {
    const entry = ensureVocabularyEntry(rawEntry)
    const key = entry.normalizedWord || `${entry.id}`
    const existing = deduped.get(key)
    deduped.set(key, existing ? mergeVocabularyEntries(existing, entry) : entry)
  }

  return Array.from(deduped.values()).sort((left, right) => right.updatedAt - left.updatedAt)
}

export function createVocabularyEntry(input: VocabularyEntryInput, timestamp = now()): VocabularyEntry {
  return ensureVocabularyEntry({
    id: uid(),
    word: input.word,
    translation: input.translation,
    translationSource: input.translationSource || (input.translation ? 'manual' : 'none'),
    contextSentence: input.contextSentence,
    notes: input.notes,
    tags: input.tags,
    positionInDoc: input.positionInDoc,
    documentId: input.documentId,
    occurrences: [
      {
        id: uid(),
        documentId: input.documentId,
        contextSentence: input.contextSentence,
        positionInDoc: input.positionInDoc,
        capturedText: input.word,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  }, timestamp)
}

export function updateVocabularyEntry(entry: VocabularyEntry, updates: Partial<VocabularyEntry>, timestamp = now()): VocabularyEntry {
  const nextOccurrences = updates.occurrences
    ? updates.occurrences
    : entry.occurrences

  return ensureVocabularyEntry({
    ...entry,
    ...updates,
    occurrences: nextOccurrences,
    updatedAt: timestamp,
    version: entry.version + 1,
  }, timestamp)
}

export function appendVocabularyOccurrence(entry: VocabularyEntry, input: VocabularyEntryInput, timestamp = now()): VocabularyEntry {
  const nextOccurrence: VocabularyOccurrence = {
    id: uid(),
    documentId: input.documentId,
    contextSentence: sanitizeVocabularyText(input.contextSentence),
    positionInDoc: Math.max(0, input.positionInDoc),
    capturedText: sanitizeVocabularyText(input.word),
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  return ensureVocabularyEntry({
    ...entry,
    translation: sanitizeVocabularyText(input.translation) || entry.translation,
    translationSource: input.translation ? input.translationSource || entry.translationSource : entry.translationSource,
    notes: sanitizeVocabularyText(input.notes) || entry.notes,
    tags: [...entry.tags, ...input.tags],
    occurrences: [...entry.occurrences, nextOccurrence],
    updatedAt: timestamp,
    version: entry.version + 1,
  }, timestamp)
}

export function applyReviewResult(
  entry: VocabularyEntry,
  grade: ReviewGrade,
  cardType: FlashcardCardType,
  timestamp = now(),
): VocabularyEntry {
  const quality = REVIEW_QUALITY[grade]
  const previous = normalizeSrsState(entry, timestamp)
  const nextEase = clamp(
    previous.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
    1.3,
    3.1,
  )

  let repetition = previous.repetition
  let intervalDays = previous.intervalDays
  let lapses = previous.lapses

  if (quality < 3) {
    repetition = 0
    intervalDays = 1
    lapses += 1
  } else if (repetition === 0) {
    repetition = 1
    intervalDays = quality >= 5 ? 2 : 1
  } else if (repetition === 1) {
    repetition = 2
    intervalDays = quality >= 5 ? 4 : 3
  } else {
    repetition += 1
    const multiplier = grade === 'hard' ? 1.2 : grade === 'easy' ? nextEase + 0.25 : nextEase
    intervalDays = Math.max(1, Math.round(previous.intervalDays * multiplier))
  }

  const dueAt = timestamp + intervalDays * 24 * 60 * 60 * 1000

  const nextEntry = ensureVocabularyEntry({
    ...entry,
    mistakeCount: grade === 'again' ? entry.mistakeCount + 1 : entry.mistakeCount,
    srs: {
      easeFactor: nextEase,
      intervalDays,
      repetition,
      dueAt,
      lastReviewedAt: timestamp,
      reviewCount: previous.reviewCount + 1,
      lapses,
    },
    reviewHistory: [
      {
        id: uid(),
        cardType,
        grade,
        reviewedAt: timestamp,
        dueAt,
        strengthAfter: entry.strengthScore,
      },
      ...entry.reviewHistory,
    ],
    updatedAt: timestamp,
    version: entry.version + 1,
  }, timestamp)

  const latestReview = nextEntry.reviewHistory[0]
  if (latestReview) {
    latestReview.strengthAfter = nextEntry.strengthScore
  }

  return nextEntry
}

export function buildFlashcardPrompts(
  entries: VocabularyEntry[],
  options?: { documentId?: string; limit?: number; dueOnly?: boolean },
): FlashcardPrompt[] {
  const timestamp = now()
  const dueOnly = options?.dueOnly ?? true
  const filteredEntries = entries.filter((entry) => {
    if (options?.documentId) {
      const inDocument = entry.occurrences.some((occurrence) => occurrence.documentId === options.documentId)
      if (!inDocument) return false
    }

    if (!dueOnly) return true
    return entry.srs.dueAt <= timestamp || entry.srs.reviewCount === 0
  })

  const prompts = filteredEntries.flatMap((entry) => {
    const cards: FlashcardPrompt[] = []

    if (entry.translation) {
      cards.push({
        id: `${entry.id}:word_to_meaning`,
        entryId: entry.id,
        type: 'word_to_meaning',
        prompt: entry.word,
        answer: entry.translation,
        exampleSentence: entry.contextSentence,
        dueAt: entry.srs.dueAt,
        strengthScore: entry.strengthScore,
        difficultyScore: entry.difficultyScore,
      })

      cards.push({
        id: `${entry.id}:meaning_to_word`,
        entryId: entry.id,
        type: 'meaning_to_word',
        prompt: entry.translation,
        answer: entry.word,
        exampleSentence: entry.contextSentence,
        dueAt: entry.srs.dueAt,
        strengthScore: entry.strengthScore,
        difficultyScore: entry.difficultyScore,
      })
    }

    if (entry.contextSentence) {
      cards.push({
        id: `${entry.id}:context_to_word`,
        entryId: entry.id,
        type: 'context_to_word',
        prompt: entry.contextSentence.replace(
          new RegExp(escapeRegExp(entry.word), 'gi'),
          '_____'
        ),
        answer: entry.word,
        exampleSentence: entry.contextSentence,
        dueAt: entry.srs.dueAt,
        strengthScore: entry.strengthScore,
        difficultyScore: entry.difficultyScore,
      })
    }

    return cards.sort((left, right) => REVIEW_CARD_ORDER.indexOf(left.type) - REVIEW_CARD_ORDER.indexOf(right.type))
  })

  return prompts
    .sort((left, right) => {
      if (left.dueAt !== right.dueAt) return left.dueAt - right.dueAt
      if (left.strengthScore !== right.strengthScore) return left.strengthScore - right.strengthScore
      return right.difficultyScore - left.difficultyScore
    })
    .slice(0, options?.limit || prompts.length)
}

export function buildVocabularyRecommendations(
  entries: VocabularyEntry[],
  options?: { documentId?: string; limit?: number },
): VocabularyEntry[] {
  const timestamp = now()
  const filtered = options?.documentId
    ? entries.filter((entry) => entry.occurrences.some((occurrence) => occurrence.documentId === options.documentId))
    : entries

  return [...filtered]
    .sort((left, right) => {
      const leftScore =
        (left.srs.dueAt <= timestamp ? 40 : 0) +
        left.mistakeCount * 12 +
        (100 - left.strengthScore) +
        Math.min(16, left.frequencyScore * 2)
      const rightScore =
        (right.srs.dueAt <= timestamp ? 40 : 0) +
        right.mistakeCount * 12 +
        (100 - right.strengthScore) +
        Math.min(16, right.frequencyScore * 2)

      return rightScore - leftScore
    })
    .slice(0, options?.limit || 8)
}

export function createVocabularySnapshot(entries: VocabularyEntry[], version = 1, deviceId = 'local'): VocabularySnapshot {
  return {
    schemaVersion: VOCABULARY_SCHEMA_VERSION,
    version,
    updatedAt: now(),
    deviceId,
    entries: normalizeVocabularyEntries(entries),
  }
}