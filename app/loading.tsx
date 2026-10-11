export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-10 md:px-8" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-9 w-56 rounded-lg" />
      <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i}>
            <div className="skeleton aspect-[2/3] rounded-xl" />
            <div className="skeleton mt-2.5 h-3.5 w-3/4 rounded" />
            <div className="skeleton mt-1.5 h-3 w-1/2 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
