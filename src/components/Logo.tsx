import type { SVGProps } from "react";

/**
 * Vexor mark — a sharp V inside a terminal window frame.
 *
 * - Outer rounded square = terminal window
 * - 3 traffic-light dots = title bar (macOS-style nod)
 * - Inner V = the brand mark
 *
 * Uses `currentColor` for both stroke and dots so it picks up the
 * surrounding text color. Pair with text-cyan-300 / text-white as needed.
 */
export function VexorMark({
  size = 24,
  className,
  ...rest
}: { size?: number | string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...rest}
    >
      {/* terminal window frame */}
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="4"
        strokeWidth="1.5"
      />
      {/* title bar separator */}
      <line x1="2" y1="9" x2="30" y2="9" strokeWidth="1" opacity="0.5" />
      {/* traffic-light dots */}
      <circle cx="6" cy="5.5" r="1" fill="currentColor" stroke="none" opacity="0.55" />
      <circle cx="9.5" cy="5.5" r="1" fill="currentColor" stroke="none" opacity="0.55" />
      <circle cx="13" cy="5.5" r="1" fill="currentColor" stroke="none" opacity="0.55" />
      {/* V mark */}
      <path
        d="M9 13 L16 25 L23 13"
        strokeWidth="2.4"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

/**
 * Horizontal lockup: V mark + "VEXOR.TERMINAL" wordmark.
 * Use in Nav and Footer. `color` controls the wordmark.
 */
export function VexorLogoLockup({
  size = 22,
  showWordmark = true,
  className,
}: {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <VexorMark size={size} className="text-cyan-300" />
      {showWordmark && (
        <span className="font-mono text-sm tracking-tight text-white/90">
          VEXOR<span className="text-cyan-300">.</span>TERMINAL
        </span>
      )}
    </span>
  );
}
