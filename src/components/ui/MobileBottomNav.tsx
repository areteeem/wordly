import { Home, FolderOpen, BookOpen, Target, MoreHorizontal, Download, Settings as SettingsIcon } from 'lucide-react'
import { useState } from 'react'

interface MobileBottomNavProps {
  onHome: () => void
  onFolders: () => void
  onVocabulary: () => void
  onExercises: () => void
  onExport: () => void
  onSettings: () => void
  activeTab: string
  dailyProgress?: number
  dailyGoal?: number
}

export function MobileBottomNav({
  onHome,
  onFolders,
  onVocabulary,
  onExercises,
  onExport,
  onSettings,
  activeTab,
  dailyProgress = 0,
  dailyGoal = 10,
}: MobileBottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false)

  const progressPercent = dailyGoal > 0 ? Math.min(100, Math.round((dailyProgress / dailyGoal) * 100)) : 0

  return (
    <>
      {/* More menu popup */}
      {moreOpen && (
        <>
          <div className="fixed inset-0 z-44" onClick={() => setMoreOpen(false)} />
          <div className="fixed bottom-[64px] right-2 z-45 bg-white dark:bg-paper-dark border-2 border-dashed border-pencil/30 dark:border-pencil-dark/30 p-2 animate-pop-in"
            style={{ borderRadius: '12px', boxShadow: '4px 4px 0px rgba(45,45,45,0.1)' }}
          >
            <button
              onClick={() => { onExport(); setMoreOpen(false) }}
              className="flex items-center gap-3 w-full px-4 py-3 text-left font-body text-base text-pencil dark:text-pencil-dark hover:bg-erased/50 dark:hover:bg-erased-dark/50 rounded-lg transition-colors"
            >
              <Download size={18} />
              Export
            </button>
            <button
              onClick={() => { onSettings(); setMoreOpen(false) }}
              className="flex items-center gap-3 w-full px-4 py-3 text-left font-body text-base text-pencil dark:text-pencil-dark hover:bg-erased/50 dark:hover:bg-erased-dark/50 rounded-lg transition-colors"
            >
              <SettingsIcon size={18} />
              Settings
            </button>
          </div>
        </>
      )}

      {/* Bottom navigation bar */}
      <nav className="mobile-bottom-nav bg-paper/95 dark:bg-paper-dark/95" role="navigation" aria-label="Main navigation">
        <button onClick={onHome} className={activeTab === 'home' ? 'active' : ''} aria-label="Home">
          <Home size={22} strokeWidth={2.2} />
          <span>Home</span>
        </button>
        <button onClick={onFolders} className={activeTab === 'folders' ? 'active' : ''} aria-label="Folders">
          <FolderOpen size={22} strokeWidth={2.2} />
          <span>Folders</span>
        </button>
        <button onClick={onVocabulary} className={activeTab === 'vocabulary' ? 'active' : ''} aria-label="Vocabulary">
          <BookOpen size={22} strokeWidth={2.2} />
          <span>Vocab</span>
          {dailyProgress > 0 && (
            <span className="nav-badge">{progressPercent}%</span>
          )}
        </button>
        <button onClick={onExercises} className={activeTab === 'exercises' ? 'active' : ''} aria-label="Exercises">
          <Target size={22} strokeWidth={2.2} />
          <span>Practice</span>
        </button>
        <button onClick={() => setMoreOpen(!moreOpen)} className={moreOpen ? 'active' : ''} aria-label="More options">
          <MoreHorizontal size={22} strokeWidth={2.2} />
          <span>More</span>
        </button>
      </nav>
    </>
  )
}
