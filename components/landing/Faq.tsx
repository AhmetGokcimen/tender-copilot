import { useTranslations } from 'next-intl';

const QUESTIONS = [1, 2, 3, 4, 5] as const;

export function Faq() {
  const t = useTranslations('landing');
  return (
    <section id="faq" className="mx-auto max-w-[820px] scroll-mt-20 px-4 py-16 md:px-8 md:py-24">
      <h2 className="text-[32px] font-light leading-[1.15] tracking-[-1px] text-ink md:text-[44px] md:leading-[50px] md:tracking-[-1.3px]">
        {t('faqTitle')}
      </h2>
      <div className="mt-8 divide-y divide-line border-y border-line">
        {QUESTIONS.map((n) => (
          <details key={n} className="group py-1">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-[17px] text-ink [&::-webkit-details-marker]:hidden">
              {t(`faq${n}Q`)}
              <span
                aria-hidden
                className="text-[22px] font-light text-muted transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none"
              >
                +
              </span>
            </summary>
            <p className="max-w-[65ch] pb-5 text-[15px] leading-[24px] text-ink-2">{t(`faq${n}A`)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
