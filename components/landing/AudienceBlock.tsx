import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Icon } from '../Icon';

const ITEMS = [
  { icon: 'flag', key: 'aud1' },
  { icon: 'swap_horiz', key: 'aud2' },
  { icon: 'insights', key: 'aud3' },
] as const;

/**
 * Who Licits is for, in plain text that search engines and AI answers can
 * quote: firms new to Romanian public tenders, firms moving on from
 * consultants, and firms already bidding. Links to the resources hub.
 */
export function AudienceBlock() {
  const t = useTranslations('landing');
  return (
    <section id="for" className="mx-auto max-w-[1200px] scroll-mt-20 px-4 pb-4 pt-8 md:px-8 md:pt-12">
      <p className="text-[14px] font-medium text-indigo-text">{t('audEyebrow')}</p>
      <h2 className="mt-3 max-w-[760px] text-[32px] font-light leading-[1.15] tracking-[-1px] text-ink md:text-[44px] md:leading-[50px] md:tracking-[-1.3px]">
        {t('audTitle')}
      </h2>
      <p className="mt-4 max-w-[62ch] text-[17px] leading-[27px] text-ink-2 md:text-[19px] md:leading-[29px]">
        {t('audSub')}
      </p>
      <ul className="mt-10 grid gap-4 md:grid-cols-3">
        {ITEMS.map(({ icon, key }) => (
          <li key={key} className="flex flex-col gap-3 rounded-card border border-line bg-raised p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-indigo-soft text-indigo-text">
              <Icon name={icon} size="md" />
            </span>
            <h3 className="text-[18px] font-medium tracking-[-0.2px] text-ink">{t(`${key}Title`)}</h3>
            <p className="text-[15px] leading-[23px] text-ink-2">{t(`${key}Body`)}</p>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link
          href="/resources"
          className="inline-flex h-11 items-center rounded-pill bg-indigo px-5 text-[15px] font-medium text-on-indigo transition-colors hover:bg-indigo-deep"
        >
          {t('audCta')}
        </Link>
        <Link
          href="/resources/tender-consultant-vs-software"
          className="text-[15px] font-medium text-indigo-text underline-offset-4 hover:underline"
        >
          {t('audCta2')}
        </Link>
      </div>
    </section>
  );
}
