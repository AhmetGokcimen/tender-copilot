import { useTranslations } from 'next-intl';

const ROWS = [1, 2, 3, 4, 5] as const;

/** The contrast: how bidding works today versus with Lichit, row by row. */
export function BeforeAfter() {
  const t = useTranslations('landing');
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-16 md:px-8 md:py-24">
      <h2 className="max-w-[760px] text-[32px] font-light leading-[1.15] tracking-[-1px] text-ink md:text-[44px] md:leading-[50px] md:tracking-[-1.3px]">
        {t('lossTitleA')} <span className="text-muted">{t('lossTitleB')}</span>
      </h2>
      <div className="mt-10 grid overflow-hidden rounded-card border border-line md:grid-cols-[1fr_1.15fr]">
        <div className="bg-sunk px-6 py-7 md:px-8">
          <p className="mb-4 text-[13px] font-semibold text-muted">{t('baToday')}</p>
          <ul className="divide-y divide-line">
            {ROWS.map((n) => (
              <li key={n} className="py-2.5 text-[16px] leading-6 text-muted">
                {t(`ba${n}Before`)}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-raised px-6 py-7 md:px-8">
          <p className="mb-4 text-[13px] font-semibold text-indigo-text">{t('baWith')}</p>
          <ul className="divide-y divide-line">
            {ROWS.map((n) => (
              <li
                key={n}
                className="py-2.5 text-[16px] leading-6 text-ink transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:translate-x-1 motion-reduce:transition-none motion-reduce:hover:translate-x-0"
              >
                {t(`ba${n}After`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
