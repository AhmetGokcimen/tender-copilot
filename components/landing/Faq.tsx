'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';

const QUESTIONS = [1, 2, 3, 4, 5] as const;

/** Questions with answers that slide open (height animates via grid rows). */
export function Faq() {
  const t = useTranslations('landing');
  const base = useId();
  const [open, setOpen] = useState<number | null>(1);

  return (
    <section id="faq" className="mx-auto max-w-[920px] scroll-mt-20 px-4 py-16 md:px-8 md:py-24">
      <h2 className="text-[36px] font-light leading-[1.1] tracking-[-1.2px] text-ink md:text-[52px] md:leading-[56px] md:tracking-[-1.8px]">
        {t('faqTitle')}
      </h2>
      <div className="mt-10 divide-y divide-line border-y border-line">
        {QUESTIONS.map((n) => {
          const isOpen = open === n;
          const id = `${base}-${n}`;
          return (
            <div key={n}>
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={id}
                  onClick={() => setOpen(isOpen ? null : n)}
                  className="group flex w-full items-center justify-between gap-6 py-6 text-left text-[19px] leading-[27px] text-ink transition-colors hover:text-indigo-text md:text-[22px] md:leading-[30px]"
                >
                  {t(`faq${n}Q`)}
                  <span
                    aria-hidden
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-[transform,background-color,border-color,color] duration-300 ${
                      isOpen ? 'rotate-45 border-indigo bg-indigo text-on-indigo' : 'border-line-strong text-ink-2'
                    }`}
                  >
                    <span className="text-[22px] font-light leading-none">+</span>
                  </span>
                </button>
              </h3>
              <div
                id={id}
                role="region"
                className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none ${
                  isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <p className="max-w-[68ch] pb-7 text-[16px] leading-[26px] text-ink-2 md:text-[17px] md:leading-[28px]">
                    {t(`faq${n}A`)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
