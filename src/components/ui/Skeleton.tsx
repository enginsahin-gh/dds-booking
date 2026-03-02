interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export function Skeleton({ className = '', width, height, rounded = 'lg' }: SkeletonProps) {
  const roundedClasses = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
    full: 'rounded-full',
  };

  return (
    <div
      className={`bg-gray-200/70 animate-pulse ${roundedClasses[rounded]} ${className}`}
      style={{ width, height }}
    />
  );
}

/** Skeleton for a stat card */
export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 lg:p-5">
      <Skeleton className="w-10 h-10 mb-3" rounded="xl" />
      <Skeleton className="h-7 w-16 mb-1.5" rounded="md" />
      <Skeleton className="h-3.5 w-24" rounded="md" />
    </div>
  );
}

/** Skeleton for an appointment card */
export function AppointmentCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3.5 flex items-center gap-3">
      <Skeleton className="w-12 h-12 flex-shrink-0" rounded="xl" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-32" rounded="md" />
        <Skeleton className="h-3 w-48" rounded="md" />
      </div>
      <Skeleton className="h-5 w-14 flex-shrink-0" rounded="md" />
    </div>
  );
}

/** Skeleton for the dashboard page */
export function DashboardSkeleton() {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="h-7 w-40 mb-2" rounded="md" />
        <Skeleton className="h-4 w-56" rounded="md" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className="flex gap-2 mb-6">
        <Skeleton className="h-10 w-36" rounded="xl" />
        <Skeleton className="h-10 w-32" rounded="xl" />
      </div>
      <Skeleton className="h-5 w-48 mb-3" rounded="md" />
      <div className="space-y-2">
        <AppointmentCardSkeleton />
        <AppointmentCardSkeleton />
        <AppointmentCardSkeleton />
      </div>
    </div>
  );
}
