/**
 * Ambient background orbs for the public landing site: 3 large blurred
 * color fields in accent/info/success tints, drifting slowly behind all
 * content. Pure atmosphere — aria-hidden, pointer-transparent, transform-
 * only animation. Variants shift placement/hue per section so the page
 * doesn't feel like one repeating image.
 */

const VARIANTS = {
  /** Hero (dark navy): brighter tints to read against the dark. */
  hero: [
    'left-[-140px] top-[-120px] h-[480px] w-[480px] bg-accent/20 blur-[100px] orb-a',
    'right-[-100px] top-[30%] h-[560px] w-[560px] bg-info/20 blur-[120px] orb-b',
    'left-[35%] bottom-[-220px] h-[420px] w-[420px] bg-success/[0.14] blur-[90px] orb-c',
  ],
  /** Light sections: deeper tones at low opacity so text stays dominant. */
  light: [
    'left-[-160px] top-[-80px] h-[440px] w-[440px] bg-info/[0.10] blur-[100px] orb-b',
    'right-[-140px] bottom-[-140px] h-[520px] w-[520px] bg-accent/[0.12] blur-[110px] orb-a',
    'left-[55%] top-[-160px] h-[380px] w-[380px] bg-success/[0.10] blur-[90px] orb-c',
  ],
  /** Dark (agents) section: cool tints, kept dim. */
  dark: [
    'right-[-120px] top-[-100px] h-[460px] w-[460px] bg-accent/[0.13] blur-[110px] orb-c',
    'left-[-140px] bottom-[-160px] h-[540px] w-[540px] bg-info/[0.14] blur-[120px] orb-a',
    'left-[45%] top-[20%] h-[360px] w-[360px] bg-success/[0.10] blur-[80px] orb-b',
  ],
} as const;

export function AmbientOrbs({ variant }: { variant: keyof typeof VARIANTS }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {VARIANTS[variant].map((cls) => (
        <span key={cls} className={`orb ${cls}`} />
      ))}
    </div>
  );
}
