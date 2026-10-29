/**
 * Near-invisible fixed blueprint grid for dashboard screens: 1px accent
 * lines at ~3.5% opacity, no animation. Technical draftsmanship, not decor.
 */
export function BlueprintGrid() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <svg width="100%" height="100%">
        <defs>
          <pattern id="ofera-blueprint" width="28" height="28" patternUnits="userSpaceOnUse">
            <path
              d="M 28 0 L 0 0 0 28"
              fill="none"
              stroke="var(--ink)"
              strokeOpacity="0.035"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ofera-blueprint)" />
      </svg>
    </div>
  );
}
