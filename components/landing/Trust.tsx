import { useTranslations } from 'next-intl';
import { Icon } from '../Icon';

const ITEMS = [
  { icon: 'account_balance', key: 'trust1' },
  { icon: 'fact_check', key: 'trust2' },
  { icon: 'how_to_reg', key: 'trust3' },
] as const;

/** A statement on the left, the three reasons to trust it on the right. */
export function Trust() {
  const t = useTranslations('landing');
  return (
    <section className="border-y border-line bg-raised">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <h2 className="text-[36px] font-light leading-[1.1] tracking-[-1.2px] text-ink md:text-[52px] md:leading-[56px] md:tracking-[-1.8px]">
          {t('trustTitleA')}
          <br />
          <span className="text-muted">{t('trustTitleB')}</span>
        </h2>
        <ul className="grid gap-8">
          {ITEMS.map(({ icon, key }) => (
            <li key={key} className="grid grid-cols-[28px_1fr] gap-4">
              <Icon name={icon} size="md" className="mt-0.5 text-indigo-text" />
              <div>
                <h3 className="text-[18px] font-medium tracking-[-0.2px] text-ink">{t(`${key}Title`)}</h3>
                <p className="mt-1.5 max-w-[52ch] text-[15px] leading-[23px] text-ink-2">{t(`${key}Body`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
