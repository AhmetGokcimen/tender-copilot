import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Icon } from '@/components/Icon';
import { SitePage } from '@/components/landing/SitePage';
import { buttonClass } from '@/components/ui/Button';

/**
 * No form-submission backend exists in this project (verified: no contact/
 * message endpoints), and no public email was provided — so this page
 * routes pilot interest through signup instead of a form that silently
 * fails or a placeholder address.
 */
export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('contact');
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
          <h2 className="text-[22px] font-normal leading-7 tracking-[-0.4px]">{t('pilotTitle')}</h2>
          <p className="text-[15px] leading-[24px] text-on-night/80">{t('pilotBody')}</p>
          <div className="pt-2">
            <Link
              href="/auth/signup"
              className={buttonClass({ variant: 'inverse' })}
            >
              {t('ctaSignup')}
            </Link>
          </div>
        </section>
        <p className="flex items-start gap-3 text-[15px] leading-[24px] text-ink-2">
          <Icon name="info" size="sm" className="mt-0.5 shrink-0 text-indigo-text" />
          {t('noEmail')}
        </p>
      </div>
    </SitePage>
  );
}
