/**
 * Reusable skeleton loading components for content placeholders
 */

function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
    />
  );
}

export function ThreadCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 space-y-3">
      <div className="flex items-center gap-2">
        <SkeletonBox className="w-8 h-8 rounded-full" />
        <SkeletonBox className="h-4 w-24" />
        <SkeletonBox className="h-3 w-16 ml-auto" />
      </div>
      <SkeletonBox className="h-5 w-3/4" />
      <SkeletonBox className="h-4 w-full" />
      <SkeletonBox className="h-4 w-2/3" />
      <div className="flex items-center gap-3 pt-1">
        <SkeletonBox className="h-3 w-12" />
        <SkeletonBox className="h-3 w-16" />
        <SkeletonBox className="h-5 w-14 rounded-full" />
      </div>
    </div>
  );
}

export function ThreadListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <ThreadCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function CommentSkeleton() {
  return (
    <div className="py-3 space-y-2">
      <div className="flex items-center gap-2">
        <SkeletonBox className="w-7 h-7 rounded-full" />
        <SkeletonBox className="h-3 w-20" />
        <SkeletonBox className="h-3 w-12" />
      </div>
      <SkeletonBox className="h-4 w-full ml-9" />
      <SkeletonBox className="h-4 w-4/5 ml-9" />
    </div>
  );
}

export function CommentListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {Array.from({ length: count }).map((_, i) => (
        <CommentSkeleton key={i} />
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="px-4 py-6 space-y-4 animate-pulse">
      <SkeletonBox className="h-7 w-2/3" />
      <SkeletonBox className="h-4 w-full" />
      <SkeletonBox className="h-4 w-4/5" />
      <SkeletonBox className="h-4 w-3/5" />
    </div>
  );
}
