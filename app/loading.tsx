export default function Loading() {
  return (
    <div className="mx-auto max-w-[1500px] px-4 pt-10 md:px-8">
      <div className="skeleton h-10 w-64 rounded-lg" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i}>
            <div className="skeleton aspect-[2/3] rounded-xl" />
            <div className="skeleton mt-2 h-4 w-3/4 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
