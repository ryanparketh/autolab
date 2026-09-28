// PLACEHOLDER wordmark — replace with the real logo SVG when available.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-[0.18em] ${className}`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <path
          d="M9 3h6M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9.5V3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M7 15h10" stroke="var(--color-accent)" strokeWidth="1.6" />
      </svg>
      <span>
        AUTO<span className="text-accent">LAB</span>
      </span>
    </span>
  );
}
