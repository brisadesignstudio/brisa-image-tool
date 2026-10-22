import { WORDMARK_PATHS, WORDMARK_VIEWBOX } from './paths';

/** Logotipo «brisa design studio» con los trazados originales. Toma el color de `color`. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox={WORDMARK_VIEWBOX}
      fill="currentColor"
      role="img"
      aria-label="brisa design studio"
      xmlns="http://www.w3.org/2000/svg"
    >
      {WORDMARK_PATHS.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
