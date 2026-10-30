import type { Metadata } from 'next';
import { JsonLd } from '@/components/seo/JsonLd';
import { webPage } from '@/lib/schema';
import { PAGE_META, pageMetadata, toLang } from '@/lib/seo';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Icon } from '@/components/Icon';
import { LogoMark } from '@/components/brand/Logo';
import { SitePage } from '@/components/landing/SitePage';
import { buttonClass } from '@/components/ui/Button';

const BELIEFS = [
  { icon: 'construction', key: 'b1' },
  { icon: 'fact_check', key: 'b2' },
  { icon: 'verified_user', key: 'b3' },
  { icon: 'travel_explore', key: 'b4' },
] as const;

const SECTION_TITLE = 'text-[28px] font-light leading-[34px] tracking-[-0.8px] text-ink md:text-[34px] md:leading-[40px]';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, '/about');
}

/** About: who Licits is for, what it believes, and how it works. */
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');
  const meta = PAGE_META['/about'][toLang(locale)];
  return (
    <SitePage wide>
      <JsonLd data={webPage(toLang(locale), 'AboutPage', '/about', meta.title, meta.description)} />
      <div className="flex flex-col gap-16 md:gap-20">
        <header className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <p className="inline-flex items-center gap-2 text-[14px] font-medium text-indigo-text">
              <Icon name="construction" size="sm" />
              {t('eyebrow')}
            </p>
            <h1 className="text-[40px] font-light leading-[1.08] tracking-[-1.4px] text-ink md:text-[56px] md:leading-[60px] md:tracking-[-2px]">
              {t('titleA')} <span className="text-muted">{t('titleB')}</span>
            </h1>
            <p className="max-w-[58ch] text-[17px] leading-[27px] text-ink-2 md:text-[19px] md:leading-[29px]">
              {t('intro')}
            </p>
          </div>
          <aside
            aria-label={t('nameTitle')}
            className="relative overflow-hidden rounded-card border border-line bg-raised p-6 shadow-lift-1"
          >
            <div
              aria-hidden
              className="absolute -bottom-16 -right-16 h-44 w-44 rounded-full opacity-70 blur-2xl"
              style={{ background: 'radial-gradient(circle, rgb(var(--ribbon-4-rgb) / 0.35), transparent 70%)' }}
            />
            <div className="relative flex flex-col gap-3">
              <LogoMark size={44} />
              <p className="font-mono text-[12px] text-muted">{t('nameTitle')}</p>
              <p className="text-[22px] font-light leading-7 tracking-[-0.5px] text-ink">{t('nameBody')}</p>
            </div>
          </aside>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-14">
          <h2 className={SECTION_TITLE}>{t('whyTitle')}</h2>
          <div className="flex flex-col gap-4 text-[16px] leading-[26px] text-ink-2">
            <p>{t('why1')}</p>
            <p>{t('why2')}</p>
          </div>
        </section>

        <section className="flex flex-col gap-8">
          <h2 className={SECTION_TITLE}>{t('beliefTitle')}</h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {BELIEFS.map(({ icon, key }) => (
              <li key={key} className="flex flex-col gap-3 rounded-card border border-line bg-raised p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-indigo-soft text-indigo-text">
                  <Icon name={icon} size="md" />
                </span>
                <h3 className="text-[18px] font-medium tracking-[-0.2px] text-ink">{t(`${key}Title`)}</h3>
                <p className="text-[15px] leading-[23px] text-ink-2">{t(`${key}Body`)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-8">
          <h2 className={SECTION_TITLE}>{t('howTitle')}</h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <li key={n} className="flex flex-col gap-2 border-t border-line-strong pt-4">
                <span className="font-mono text-[13px] font-medium text-indigo-text">0{n}</span>
                <h3 className="text-[18px] font-medium tracking-[-0.2px] text-ink">{t(`s${n}Title`)}</h3>
                <p className="text-[15px] leading-[23px] text-ink-2">{t(`s${n}Body`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="relative overflow-hidden rounded-card bg-night p-8 text-on-night md:p-12">
          <div
            aria-hidden
            className="absolute -right-20 -top-24 h-72 w-72 rounded-full opacity-60 blur-3xl"
            style={{ background: 'radial-gradient(circle, rgb(var(--ribbon-4-rgb) / 0.35), transparent 70%)' }}
          />
          <div className="relative flex flex-col gap-4">
            <h2 className="max-w-[20ch] text-[30px] font-light leading-[36px] tracking-[-0.9px] md:text-[38px] md:leading-[44px]">
              {t('ctaTitle')}
            </h2>
            <p className="max-w-[52ch] text-[15px] leading-[24px] text-on-night/80">{t('ctaBody')}</p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/#waitlist" className={buttonClass({ variant: 'inverse' })}>
                {t('ctaSignup')}
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-11 items-center rounded-pill border border-on-night/30 px-5 text-[15px] font-medium text-on-night transition-colors hover:bg-on-night/10"
              >
                {t('ctaContact')}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </SitePage>
  );
}
