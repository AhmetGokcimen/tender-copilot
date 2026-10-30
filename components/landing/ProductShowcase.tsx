import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Icon } from '../Icon';

const FEATURES = [
  { icon: 'filter_list', key: 'pShow1' },
  { icon: 'fact_check', key: 'pShow2' },
  { icon: 'view_kanban', key: 'pShow3' },
] as const;

/**
 * A real screenshot of the app (captured from the product itself, per
 * locale) in a browser frame that bleeds off the right edge, with the
 * three things the dashboard does on the left.
 */
export function ProductShowcase() {
  const t = useTranslations('landing');
  const locale = useLocale() === 'ro' ? 'ro' : 'en';
  return (
    <section id="product" className="relative scroll-mt-20 overflow-hidden py-16 md:py-24">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-10 px-4 md:px-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-14">
        <div>
          <h2 className="text-[32px] font-light leading-[1.15] tracking-[-1px] text-ink md:text-[40px] md:leading-[46px] md:tracking-[-1.2px]">
            {t('pShowTitle')}
          </h2>
          <ul className="mt-8 grid gap-6">
            {FEATURES.map(({ icon, key }) => (
              <li key={key} className="grid grid-cols-[24px_1fr] gap-3">
                <Icon name={icon} size="md" className="mt-0.5 text-indigo-text" />
                <div>
                  <h3 className="text-[16px] font-medium text-ink">{t(`${key}Title`)}</h3>
                  <p className="mt-1 text-[14px] leading-[22px] text-ink-2">{t(`${key}Body`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative lg:-mr-[22%]">
          <div
            aria-hidden
            className="absolute -inset-8 rounded-[40px] opacity-60 blur-3xl"
            style={{
              background:
                'radial-gradient(50% 50% at 30% 40%, rgba(79,70,229,0.22), transparent 70%), radial-gradient(45% 45% at 80% 70%, rgba(255,176,32,0.20), transparent 70%)',
            }}
          />
          <figure
            className="relative overflow-hidden rounded-[14px] border border-line bg-raised shadow-lift-2"
            style={{
              // Fade out toward the right edge, like the screenshot is sliding off the page.
              maskImage: 'linear-gradient(90deg, #000 55%, transparent 96%)',
              WebkitMaskImage: 'linear-gradient(90deg, #000 55%, transparent 96%)',
            }}
          >
            <div className="flex items-center gap-1.5 border-b border-line bg-sunk px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong/60" />
              <span className="mx-auto rounded-pill bg-raised px-3 py-0.5 font-mono text-[11px] text-muted">
                Licits
              </span>
            </div>
            <Image
              src={`/product/dashboard-${locale}.webp`}
              alt={t('pShowAlt')}
              width={2880}
              height={1800}
              sizes="(min-width: 1024px) 900px, 100vw"
              className="block h-auto w-full"
            />
          </figure>
        </div>
      </div>
    </section>
  );
}
