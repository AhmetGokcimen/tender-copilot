'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '../Icon';
import { WaitlistForm } from './WaitlistForm';

const PERKS = ['wlPerk1', 'wlPerk2', 'wlPerk3'] as const;

/** Directly under the hero: the waitlist and its two-week free trial offer. */
export function WaitlistSection() {
  const t = useTranslations('landing');
  return (
    <section id="waitlist" className="scroll-mt-20 border-y border-line bg-raised/70">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-10 px-4 py-14 md:px-8 md:py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div>
          <h2 className="text-[32px] font-light leading-[1.15] tracking-[-1px] text-ink md:text-[44px] md:leading-[50px] md:tracking-[-1.3px]">
            {t('wlTitleA')} <span className="text-indigo-text">{t('wlTitleB')}</span>
          </h2>
          <p className="mt-4 max-w-[52ch] text-[17px] leading-[27px] text-ink-2">{t('wlBody')}</p>
          <ul className="mt-6 grid gap-3">
            {PERKS.map((k) => (
              <li key={k} className="flex items-start gap-3 text-[15px] leading-[23px] text-ink">
                <Icon name="check" className="mt-0.5 text-eligible" />
                {t(k)}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-card border border-line bg-paper p-6 md:p-8">
          <WaitlistForm source="hero" />
        </div>
      </div>
    </section>
  );
}
