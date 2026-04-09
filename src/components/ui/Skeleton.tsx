export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-paper-dark border-2 border-pencil/10 dark:border-pencil-dark/10 p-4" style={{ borderRadius: '12px' }}>
      <div className="skeleton h-4 w-2/3 mb-3" />
      <div className="skeleton h-3 w-full mb-2" />
      <div className="skeleton h-3 w-4/5 mb-4" />
      <div className="flex gap-3">
        <div className="skeleton h-3 w-16" />
        <div className="skeleton h-3 w-12" />
        <div className="skeleton h-3 w-20" />
      </div>
    </div>
  )
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-paper-dark border-2 border-pencil/10 dark:border-pencil-dark/10 p-4 text-center" style={{ borderRadius: '12px' }}>
          <div className="skeleton h-6 w-6 mx-auto mb-2 rounded-full" />
          <div className="skeleton h-8 w-12 mx-auto mb-1" />
          <div className="skeleton h-3 w-16 mx-auto" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonVocabRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-pencil/5 dark:border-pencil-dark/5">
      <div className="skeleton h-4 w-4 rounded-full flex-shrink-0" />
      <div className="skeleton h-4 w-24" />
      <div className="skeleton h-4 w-20" />
      <div className="flex-1" />
      <div className="skeleton h-3 w-16" />
    </div>
  )
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonVocabRow key={i} />
      ))}
    </div>
  )
}
