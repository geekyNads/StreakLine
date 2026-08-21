export function DashboardSkeleton() {
  return (
    <div className="mt-10 animate-pulse">
      <div className="grid grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <div className="h-8 w-14 rounded bg-hairline dark:bg-white/10" />
            <div className="mt-2 h-3 w-20 rounded bg-hairline dark:bg-white/10" />
          </div>
        ))}
      </div>
      <div className="mt-10 h-[95px] w-full rounded bg-hairline dark:bg-white/10" />
    </div>
  );
}
