import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Icon } from '@/components/Icon';
import { SitePage } from '@/components/landing/SitePage';
import { buttonClass } from '@/components/ui/Button';

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pricing');
  return (
    <SitePage>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3">
          <h1 className="max-w-2xl text-[36px] font-light leading-[1.1] tracking-[-1.2px] text-ink md:text-[48px] md:leading-[52px] md:tracking-[-1.6px]">
            {t('title')}
          </h1>
          <p className="max-w-[60ch] text-[17px] leading-[27px] text-ink-2 md:text-[19px] md:leading-[29px]">{t('sub')}</p>
        </header>
        <section className="flex flex-col gap-3 rounded-card bg-night p-6 text-on-night md:p-8">
          <span className="text-[13px] font-medium text-on-night/70">
            {t('planName')}
          </span>
          <p className="text-[34px] font-light leading-[40px] tracking-[-1px]">{t('planPrice')}</p>
          <p className="text-[15px] leading-[24px] text-on-night/80">{t('planBody')}</p>
          <div className="pt-2">
            <Link
              href="/#waitlist"
              className={buttonClass({ variant: 'inverse' })}
            >
              {t('planCta')}
            </Link>
          </div>
        </section>
        <section className="flex flex-col gap-3 rounded-card border border-line bg-raised p-6 md:p-8">
          <h2 className="text-[22px] font-normal leading-7 tracking-[-0.4px] text-ink">{t('includedTitle')}</h2>
          <ul className="flex flex-col gap-2">
            {[t('included1'), t('included2'), t('included3'), t('included4')].map((w) => (
              <li key={w} className="flex items-start gap-3 text-[15px] leading-[24px] text-ink">
                <Icon name="check_circle" size="sm" className="mt-0.5 shrink-0 text-success" />
                {w}
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-3 rounded-card border border-line bg-raised p-6 md:p-8">
          <h2 className="text-[22px] font-normal leading-7 tracking-[-0.4px] text-ink">{t('laterTitle')}</h2>
          <p className="text-[15px] leading-[24px] text-ink-2">{t('laterBody')}</p>
          <div className="pt-2">
            <Link
              href="/contact"
              className={buttonClass({ variant: 'secondary' })}
            >
              {t('contactCta')}
            </Link>
          </div>
        </section>
      </div>
    </SitePage>
  );
}
