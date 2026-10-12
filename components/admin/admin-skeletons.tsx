import { Skeleton } from "@/components/ui/skeleton";

function LoadingRegion({ children, label = "Loading" }: { children: React.ReactNode; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-6">
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <LoadingRegion label="Loading dashboard">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-40 rounded-xl" />)}
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-36 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </LoadingRegion>
  );
}

export function AdminTableSkeleton({ label = "Loading table", rows = 6 }: { label?: string; rows?: number }) {
  return (
    <LoadingRegion label={label}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
      <Skeleton className="h-16 rounded-xl" />
      <div className="overflow-x-auto rounded-xl border border-border">
        <div className="grid grid-cols-[2.5rem_minmax(12rem,1fr)_8rem_8rem_9rem_7rem] gap-4 border-b border-border bg-muted/40 px-4 py-3">
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-4" />)}
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="grid grid-cols-[2.5rem_minmax(12rem,1fr)_8rem_8rem_9rem_7rem] items-center gap-4 px-4 py-4">
              <Skeleton className="h-4 w-4" />
              <div className="flex items-center gap-3"><Skeleton className="h-10 w-14 rounded-md" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="ml-auto h-8 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-9 w-48 rounded-md" /></div>
    </LoadingRegion>
  );
}

export function AdminUsersSkeleton() {
  return <AdminTableSkeleton label="Loading users" rows={7} />;
}

export function AdminSettingsSkeleton() {
  return (
    <LoadingRegion label="Loading settings">
      <div className="space-y-2"><Skeleton className="h-9 w-48" /><Skeleton className="h-5 w-96 max-w-full" /></div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-64 rounded-xl" />)}
      </div>
      <Skeleton className="h-12 w-32 rounded-xl" />
    </LoadingRegion>
  );
}

export function AdminFormSkeleton() {
  return (
    <LoadingRegion label="Loading editor">
      <div className="space-y-2"><Skeleton className="h-9 w-64" /><Skeleton className="h-5 w-96 max-w-full" /></div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5 rounded-xl border border-border p-5"><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /><Skeleton className="h-56 w-full rounded-lg" /><Skeleton className="h-48 w-full rounded-lg" /></div>
        <div className="space-y-4 rounded-xl border border-border p-5"><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /><Skeleton className="h-10 w-32 rounded-xl" /></div>
      </div>
    </LoadingRegion>
  );
}
