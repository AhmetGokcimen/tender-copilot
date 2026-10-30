'use client';

import { useTranslations } from 'next-intl';
import { WaitlistForm } from './WaitlistForm';

/** The one dark band on the page: the closing waitlist. */
export function ClosingCta() {
  const t = useTranslations('landing');
  return (
    <section className="bg-night">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-end gap-10 px-4 py-20 md:px-8 md:py-28 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h2 className="max-w-[620px] text-[36px] font-light leading-[1.1] tracking-[-1.2px] text-on-night md:text-[52px] md:leading-[56px] md:tracking-[-1.8px]">
            {t('closingTitle')}
          </h2>
          <p className="mt-4 max-w-[480px] text-[17px] leading-[27px] text-[#c5cad8]">{t('closingSub')}</p>
        </div>
        <WaitlistForm source="closing" onDark />
      </div>
    </section>
  );
}
