/**
 * Step progress dots for the guide walkthrough.
 */
export default function GuideProgress({ current, total }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i === current
              ? 'w-5 h-2 bg-green-500'
              : i < current
                ? 'w-2 h-2 bg-green-300'
                : 'w-2 h-2 bg-gray-300'
          }`}
        />
      ))}
    </div>
  )
}
