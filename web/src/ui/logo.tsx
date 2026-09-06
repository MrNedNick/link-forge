export function Logo({ className }: { className?: string }) {
  return (
    <span className={className}>
      <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="fill-accent" />
        <path
          d="M12.5 19.5a4.6 4.6 0 0 1 0-6.5l2.2-2.2a4.6 4.6 0 0 1 6.5 6.5l-1.2 1.2"
          fill="none"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M19.5 12.5a4.6 4.6 0 0 1 0 6.5l-2.2 2.2a4.6 4.6 0 0 1-6.5-6.5l1.2-1.2"
          fill="none"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.72"
        />
      </svg>
    </span>
  )
}
