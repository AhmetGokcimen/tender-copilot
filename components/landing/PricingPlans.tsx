import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { buttonClass } from '../ui/Button';

type Tier = {
  id: 'start' | 'growth' | 'pro';
  price: number;
  /** Message keys for included lines, then the ones this tier lacks. */
  has: string[];
  lacks: string[];
};

const TIERS: Tier[] = [
  {
    id: 'start',
    price: 199,
    has: ['fFeed', 'fFiltersStd', 'fElig15', 'fUsers1'],
    lacks: ['fOcr', 'fDrafts', 'fWinners', 'fRenewal'],
  },
  {
    id: 'growth',
    price: 399,
    has: ['fFeed', 'fFiltersWide', 'fElig60', 'fOcr20', 'fDrafts4', 'fWinners', 'fAuth', 'fUsers3'],
    lacks: ['fRenewal'],
  },
  {
    id: 'pro',
    price: 749,
    has: [
      'fFeed',
      'fFiltersAll',
      'fEligUnl',
      'fOcrUnl',
      'fDraftsUnl',
      'fWinnersTrend',
      'fRenewal',
      'fAuth',
      'fUsers10',
    ],
    lacks: [],
  },
];

/**
 * Three plans priced by the value each delivers. Growth covers what most
 * SMEs need and carries the highlighted card; prices exclude VAT (TVA).
 */
export function PricingPlans({ heading = true }: { heading?: boolean }) {
  const t = useTranslations('pricing');
  return (
    <section id="pricing" className="mx-auto max-w-[1200px] scroll-mt-20 px-4 py-16 md:px-8 md:py-24">
      {heading && (
        <h2 className="max-w-[760px] text-[32px] font-light leading-[1.15] tracking-[-1px] text-ink md:text-[44px] md:leading-[50px] md:tracking-[-1.3px]">
          {t('plansTitle')}
        </h2>
      )}
      <p className="mt-4 inline-flex rounded-pill bg-indigo-soft px-3 py-1 text-[13px] font-medium text-indigo-text">
        {t('plansTrial')}
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.08fr_1fr] lg:items-stretch">
        {TIERS.map((tier) => {
          const featured = tier.id === 'growth';
          return (
            <article
              key={tier.id}
              className={`relative flex flex-col rounded-card p-7 md:p-8 ${
                featured ? 'bg-night text-on-night shadow-lift-2' : 'border border-line bg-raised text-ink'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[18px] font-medium">{t(`${tier.id}Name`)}</h3>
                {featured && (
                  <span className="rounded-pill bg-ribbon-4 px-2.5 py-0.5 text-[12px] font-semibold text-night">
                    {t('recommendedBadge')}
                  </span>
                )}
              </div>
              <p className={`mt-1 text-[14px] ${featured ? 'text-on-night/70' : 'text-muted'}`}>{t(`${tier.id}For`)}</p>
              <p className="mt-6 flex items-baseline gap-1.5">
                <span className="font-mono text-[44px] leading-none tracking-[-1.5px]">{tier.price}</span>
                <span className={`text-[14px] ${featured ? 'text-on-night/70' : 'text-muted'}`}>{t('perMonth')}</span>
              </p>
                            <ul className="mt-6 grid flex-1 content-start gap-2.5 text-[14px] leading-[21px]">
                {tier.has.map((k) => (
                  <li key={k} className="flex gap-2.5">
                    <span aria-hidden className={featured ? 'text-ribbon-4' : 'text-eligible'}>
                      ✓
                    </span>
                    {t(k)}
                  </li>
                ))}
                {tier.lacks.map((k) => (
                  <li key={k} className={`flex gap-2.5 line-through ${featured ? 'text-on-night/40' : 'text-muted/70'}`}>
                    <span aria-hidden>-</span>
                    <span>
                      <span className="sr-only">{t('notIncluded')}: </span>
                      {t(k)}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/#waitlist"
                className={`mt-8 ${buttonClass({ variant: featured ? 'inverse' : 'secondary' })}`}
              >
                {t('planCta')}
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
