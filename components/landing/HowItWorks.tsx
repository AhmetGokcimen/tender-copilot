import { useTranslations } from 'next-intl';
import { SpotlightCard } from './SpotlightCard';

const FEED = [
  { id: 'CN1071301', cpv: '45233141-9', hit: false },
  { id: 'CN1071284', cpv: '30213000-5', hit: true },
  { id: 'CN1071296', cpv: '79341000-6', hit: false },
  { id: 'CN1071311', cpv: '90910000-9', hit: false },
];

function Step({ k, title, body }: { k: string; title: string; body: string }) {
  return (
    <>
      <p className="font-mono text-[12px] font-medium text-indigo-text">{k}</p>
      <h3 className="mt-1 text-[22px] font-normal leading-7 tracking-[-0.4px] text-ink">{title}</h3>
      <p className="mt-2 max-w-[46ch] text-[15px] leading-[23px] text-ink-2">{body}</p>
    </>
  );
}

/** Monitor, Qualify, Draft, Submit as an asymmetric grid with spotlight borders. */
export function HowItWorks() {
  const t = useTranslations('landing');
  return (
    <section id="how" className="mx-auto max-w-[1200px] scroll-mt-20 px-4 py-16 md:px-8 md:py-24">
      <h2 className="max-w-[700px] text-[32px] font-light leading-[1.15] tracking-[-1px] text-ink md:text-[44px] md:leading-[50px] md:tracking-[-1.3px]">
        {t('howTitle')}
      </h2>
      <div className="mt-10 grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:grid-rows-[auto_auto]">
        <SpotlightCard className="flex flex-col justify-between bg-sunk p-7 lg:row-span-2">
          <div>
            <Step k={t('monitor')} title={t('monitorTitle')} body={t('monitorBody')} />
          </div>
          <div className="mt-6 grid gap-2 font-mono text-[13px] font-medium">
            {FEED.map((r) => (
              <div
                key={r.id}
                className={`flex justify-between gap-4 rounded-field bg-raised px-3.5 py-2.5 ${
                  r.hit ? 'text-ink shadow-[inset_0_0_0_1px_var(--indigo)]' : 'text-muted'
                }`}
              >
                <span className="truncate">
                  {r.id}&nbsp;&nbsp;CPV {r.cpv}
                </span>
                <span className={r.hit ? 'text-eligible' : ''}>{r.hit ? t('feedMatch') : t('feedSkip')}</span>
              </div>
            ))}
          </div>
        </SpotlightCard>
        <SpotlightCard className="bg-raised p-7">
          <Step k={t('qualify')} title={t('qualifyTitle')} body={t('qualifyBody')} />
        </SpotlightCard>
        <div className="grid gap-4 sm:grid-cols-2">
          <SpotlightCard className="bg-raised p-7">
            <Step k={t('draft')} title={t('draftTitle')} body={t('draftBody')} />
          </SpotlightCard>
          <SpotlightCard className="bg-raised p-7">
            <Step k={t('submit')} title={t('submitTitle')} body={t('submitBody')} />
          </SpotlightCard>
        </div>
      </div>
    </section>
  );
}
