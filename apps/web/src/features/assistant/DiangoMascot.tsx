/**
 * Diango, an original stylised dog drawn with simple shapes (Design System — AI-assisted
 * experiences). Decorative: the surrounding control carries the accessible name. The tail wags
 * with CSS (`.diango-tail` in global.css), switched off under prefers-reduced-motion.
 */
export function DiangoMascot({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      className={className}
      data-testid="diango-mascot"
    >
      <g className="diango-tail">
        <path
          d="M47 40 C55 38 58 30 56 24"
          fill="none"
          stroke="#8a5a3c"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </g>
      <ellipse cx="34" cy="44" rx="15" ry="11" fill="#c98a5e" />
      <rect x="23" y="49" width="5" height="10" rx="2.5" fill="#c98a5e" />
      <rect x="38" y="49" width="5" height="10" rx="2.5" fill="#c98a5e" />
      <circle cx="24" cy="26" r="14" fill="#d9a074" />
      <ellipse cx="12" cy="24" rx="5" ry="10" fill="#8a5a3c" transform="rotate(15 12 24)" />
      <ellipse cx="35" cy="20" rx="5" ry="9" fill="#8a5a3c" transform="rotate(-25 35 20)" />
      <ellipse cx="20" cy="32" rx="8" ry="6" fill="#f3dcc6" />
      <circle cx="19" cy="24" r="2" fill="#1f1a1c" />
      <circle cx="29" cy="24" r="2" fill="#1f1a1c" />
      <ellipse cx="20" cy="30" rx="3" ry="2.2" fill="#1f1a1c" />
      <path
        d="M17 34 Q20 37 23 34"
        fill="none"
        stroke="#1f1a1c"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M22 39 L34 39" stroke="#b4235a" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
