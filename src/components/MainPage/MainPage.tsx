import { useMemo, useState, useEffect } from 'react'
import { FileText, FolderOpen, BookOpen, Plus, Clock, TrendingUp, Flame, Star, Volume2, Eye, EyeOff, BarChart3, Sparkles, BookMarked } from 'lucide-react'
import { useDocumentStore } from '../../stores/documentStore'
import { useVocabularyStore } from '../../stores/vocabularyStore'
import { useFolderStore } from '../../stores/folderStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { Button } from '../ui/Button'
import { SkeletonCard, SkeletonStats } from '../ui/Skeleton'
import { wobblyMd, wobbly } from '../../lib/utils'
import { loadData, saveData } from '../../services/storage'

interface StreakData {
  currentStreak: number
  lastActiveDate: string
  activeDays: string[]
}

function getStreakData(entries: { createdAt: number }[]): StreakData {
  const saved = (() => { try { const d = localStorage.getItem('wordly-streak'); return d ? JSON.parse(d) : null } catch { return null } })()
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  // Collect unique active days
  const activeDaysSet = new Set<string>(saved?.activeDays || [])
  entries.forEach(e => activeDaysSet.add(new Date(e.createdAt).toISOString().slice(0, 10)))

  const activeDays = Array.from(activeDaysSet).sort()
  const todayActive = entries.some(e => new Date(e.createdAt).toISOString().slice(0, 10) === today)

  let streak = 0
  if (todayActive || saved?.lastActiveDate === yesterday) {
    let checkDate = new Date(today)
    while (activeDaysSet.has(checkDate.toISOString().slice(0, 10))) {
      streak++
      checkDate = new Date(checkDate.getTime() - 86400000)
    }
  }

  const data: StreakData = {
    currentStreak: streak,
    lastActiveDate: todayActive ? today : saved?.lastActiveDate || '',
    activeDays: activeDays.slice(-30),
  }
  localStorage.setItem('wordly-streak', JSON.stringify(data))
  return data
}

export function MainPage() {
  const documents = useDocumentStore((s) => s.documents)
  const createDocument = useDocumentStore((s) => s.createDocument)
  const setActiveDocument = useDocumentStore((s) => s.setActiveDocument)
  const entries = useVocabularyStore((s) => s.entries)
  const activeFolderId = useFolderStore((s) => s.activeFolderId)
  const folders = useFolderStore((s) => s.folders)
  const dailyGoal = useSettingsStore((s) => s.settings.dailyGoal)
  const [loading, setLoading] = useState(true)
  const [wotdRevealed, setWotdRevealed] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400)
    return () => clearTimeout(t)
  }, [])

  const recentDocs = useMemo(() => {
    return [...documents].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6)
  }, [documents])

  const todayCount = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return entries.filter((e) => e.createdAt >= today.getTime()).length
  }, [entries])

  const streak = useMemo(() => getStreakData(entries), [entries])

  // Word of the Day (Feature #12) — seeded by date
  const wordOfDay = useMemo(() => {
    if (entries.length === 0) return null
    const dayHash = new Date().toISOString().slice(0, 10).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    return entries[dayHash % entries.length]
  }, [entries])

  // Mastery distribution (Feature #20)
  const masteryDist = useMemo(() => {
    const learning = entries.filter(e => e.mastery === 'learning').length
    const familiar = entries.filter(e => e.mastery === 'familiar').length
    const mastered = entries.filter(e => e.mastery === 'mastered').length
    return { learning, familiar, mastered, total: entries.length }
  }, [entries])

  // Weekly activity (Feature #20)
  const weeklyActivity = useMemo(() => {
    const days: { label: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const dateStr = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('en', { weekday: 'short' })
      const count = entries.filter(e => new Date(e.createdAt).toISOString().slice(0, 10) === dateStr).length
      days.push({ label, count })
    }
    return days
  }, [entries])

  const maxWeekly = Math.max(1, ...weeklyActivity.map(d => d.count))

  // Spaced repetition due count (Feature #29)
  const dueCount = useMemo(() => {
    const now = Date.now()
    return entries.filter(e => {
      const daysSince = (now - e.updatedAt) / 86400000
      if (e.mastery === 'learning') return daysSince >= 1
      if (e.mastery === 'familiar') return daysSince >= 3
      return daysSince >= 14
    }).length
  }, [entries])

  const stats = [
    { label: 'Documents', value: documents.length, icon: FileText, color: 'text-pen' },
    { label: 'Words Learned', value: entries.length, icon: BookOpen, color: 'text-pen' },
    { label: 'Added Today', value: todayCount, icon: TrendingUp, color: todayCount >= dailyGoal ? 'text-green-500' : 'text-orange-400' },
    { label: 'Folders', value: folders.length, icon: FolderOpen, color: 'text-pen' },
  ]

  const pronounceWord = (text: string) => {
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.85
    speechSynthesis.speak(u)
  }

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

        {/* Streak Banner (Feature #19) */}
        {streak.currentStreak > 0 && (
          <div
            className="flex items-center justify-center gap-3 mb-6 py-3 px-5 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-2 border-dashed border-orange-300/50 dark:border-orange-600/30 animate-pop-in"
            style={{ borderRadius: wobblyMd }}
          >
            <Flame size={24} className="text-orange-500 animate-bounce" style={{ animationDuration: '2s' }} />
            <span className="font-heading text-2xl text-orange-600 dark:text-orange-400">
              {streak.currentStreak} day streak!
            </span>
            <Flame size={24} className="text-orange-500 animate-bounce" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
          </div>
        )}

        {/* Stats row (Feature #6 skeleton) */}
        {loading ? (
          <div className="mb-10"><SkeletonStats /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className="bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark p-4 text-center transition-all duration-150 hover:rotate-1 hover:-translate-y-1 hover:shadow-hard dark:hover:shadow-hard-dark active:scale-95"
                style={{ borderRadius: wobblyMd, boxShadow: '3px 3px 0px 0px rgba(45,45,45,0.1)', animationDelay: `${i * 60}ms` }}
              >
                <stat.icon size={24} strokeWidth={2.5} className={`mx-auto mb-1 ${stat.color}`} />
                <p className="font-heading text-3xl text-pencil dark:text-pencil-dark">{stat.value}</p>
                <p className="font-body text-sm text-pencil/50 dark:text-pencil-dark/50">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Daily Goal Progress Bar */}
        {dailyGoal > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="font-body text-sm text-pencil/60 dark:text-pencil-dark/60">
                Daily Goal: {todayCount} / {dailyGoal} words
              </span>
              {todayCount >= dailyGoal && (
                <span className="font-body text-sm text-green-500 flex items-center gap-1">
                  <Sparkles size={14} /> Goal reached!
                </span>
              )}
            </div>
            <div className="h-3 bg-erased dark:bg-erased-dark overflow-hidden" style={{ borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px' }}>
              <div
                className={`h-full transition-all duration-500 ${
                  todayCount >= dailyGoal ? 'bg-green-400' : todayCount >= dailyGoal * 0.5 ? 'bg-yellow-400' : 'bg-red-400'
                }`}
                style={{
                  width: `${Math.min(100, (todayCount / dailyGoal) * 100)}%`,
                  borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px',
                }}
              />
            </div>
          </div>
        )}

        {/* Word of the Day (Feature #12) */}
        {wordOfDay && (
          <div
            className="wotd-card mb-8 bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark p-6 animate-pop-in"
            style={{ borderRadius: wobblyMd, boxShadow: '4px 4px 0px 0px rgba(45,45,45,0.1)' }}
          >
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <BookMarked size={18} className="text-pen" />
                <h3 className="font-heading text-lg text-pen">Word of the Day</h3>
              </div>
              <div className="flex items-center gap-4 mb-2">
                <span className="font-heading text-3xl text-pencil dark:text-pencil-dark">
                  {wordOfDay.word}
                </span>
                <button
                  onClick={() => pronounceWord(wordOfDay.word)}
                  className="p-1.5 rounded-full hover:bg-erased/50 dark:hover:bg-erased-dark/50 text-pencil/40 hover:text-pen transition-colors"
                  aria-label="Pronounce word"
                >
                  <Volume2 size={18} />
                </button>
                <button
                  onClick={() => setWotdRevealed(!wotdRevealed)}
                  className="p-1.5 rounded-full hover:bg-erased/50 dark:hover:bg-erased-dark/50 text-pencil/40 hover:text-pen transition-colors"
                  aria-label={wotdRevealed ? 'Hide translation' : 'Show translation'}
                >
                  {wotdRevealed ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className={`font-body text-xl text-pen transition-all duration-300 ${wotdRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 select-none'}`}>
                {wordOfDay.translation}
              </div>
              {wordOfDay.contextSentence && (
                <p className="font-body text-sm text-pencil/40 dark:text-pencil-dark/40 mt-2 italic">
                  "{wordOfDay.contextSentence}"
                </p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <span className={`text-xs font-body px-2 py-0.5 rounded-full ${
                  wordOfDay.mastery === 'mastered' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : wordOfDay.mastery === 'familiar' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {wordOfDay.mastery}
                </span>
                {wordOfDay.starred && <Star size={14} className="text-yellow-500 fill-yellow-500" />}
              </div>
            </div>
          </div>
        )}

        {/* Progress Dashboard (Feature #20) */}
        {entries.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {/* Mastery Distribution */}
            <div
              className="bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark p-5"
              style={{ borderRadius: wobblyMd, boxShadow: '3px 3px 0px 0px rgba(45,45,45,0.1)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={18} className="text-pen" />
                <h3 className="font-heading text-lg text-pencil dark:text-pencil-dark">Mastery Progress</h3>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Learning', count: masteryDist.learning, color: 'bg-red-400', pct: masteryDist.total ? (masteryDist.learning / masteryDist.total) * 100 : 0 },
                  { label: 'Familiar', count: masteryDist.familiar, color: 'bg-yellow-400', pct: masteryDist.total ? (masteryDist.familiar / masteryDist.total) * 100 : 0 },
                  { label: 'Mastered', count: masteryDist.mastered, color: 'bg-green-400', pct: masteryDist.total ? (masteryDist.mastered / masteryDist.total) * 100 : 0 },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between font-body text-sm text-pencil/60 dark:text-pencil-dark/60 mb-1">
                      <span>{item.label}</span>
                      <span>{item.count} ({Math.round(item.pct)}%)</span>
                    </div>
                    <div className="h-2.5 bg-erased dark:bg-erased-dark rounded-full overflow-hidden">
                      <div className={`mastery-bar h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly Activity Chart */}
            <div
              className="bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark p-5"
              style={{ borderRadius: wobblyMd, boxShadow: '3px 3px 0px 0px rgba(45,45,45,0.1)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={18} className="text-pen" />
                <h3 className="font-heading text-lg text-pencil dark:text-pencil-dark">This Week</h3>
                {dueCount > 0 && (
                  <span className="ml-auto text-xs font-body px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    {dueCount} due for review
                  </span>
                )}
              </div>
              <div className="flex items-end gap-2 h-24">
                {weeklyActivity.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="font-body text-xs text-pencil/40 dark:text-pencil-dark/40">{day.count > 0 ? day.count : ''}</span>
                    <div
                      className="chart-bar w-full bg-pen/70 dark:bg-pen/50 rounded-t"
                      style={{
                        height: `${day.count > 0 ? Math.max(8, (day.count / maxWeekly) * 80) : 4}px`,
                        opacity: day.count > 0 ? 1 : 0.2,
                      }}
                    />
                    <span className="font-body text-[10px] text-pencil/30 dark:text-pencil-dark/30">{day.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="flex gap-3 mb-10 justify-center flex-wrap">
          <Button onClick={() => createDocument(activeFolderId)} size="md">
            <Plus size={18} strokeWidth={2.5} />
            New Document
          </Button>
        </div>

        {/* Recent documents */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : recentDocs.length > 0 ? (
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
                    className="text-left bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark p-4 transition-all duration-150 hover:rotate-[0.5deg] hover:-translate-y-0.5 hover:shadow-hard dark:hover:shadow-hard-dark group active:scale-[0.98]"
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
        ) : (
          /* Enhanced empty state (Feature #15) */
          <div
            className="text-center bg-postit border-2 border-pencil dark:border-pencil-dark p-8 animate-pop-in"
            style={{ borderRadius: wobblyMd, transform: 'rotate(1deg)' }}
          >
            <div className="text-6xl mb-4" aria-hidden="true">📝</div>
            <p className="font-heading text-2xl text-pencil mb-2">
              No documents yet!
            </p>
            <p className="font-body text-lg text-pencil/60 mb-4">
              Create your first document and start building your vocabulary.
            </p>
            <div className="flex flex-col items-center gap-3">
              <Button onClick={() => createDocument(activeFolderId)} size="md">
                <Plus size={18} strokeWidth={2.5} />
                Get Started
              </Button>
              <div className="font-body text-sm text-pencil/40 space-y-1">
                <p>💡 Highlight words in your text to add them to vocabulary</p>
                <p>🎯 Practice with 6 different exercise types</p>
                <p>📊 Track your learning progress over time</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
