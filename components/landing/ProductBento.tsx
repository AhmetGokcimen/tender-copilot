import { useLocale, useTranslations } from 'next-intl';
import { Icon } from '../Icon';

/** A slice of the hero silk bleeding off a card edge (purely decorative). */
function Wash({ from, to, className }: { from: string; to: string; className: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-[48%] blur-[2px] ${className}`}
      style={{ background: `linear-gradient(115deg, var(${from}), var(${to}))` }}
    />
  );
}

function Card({
  title,
  body,
  className = '',
  children,
}: {
  title: string;
  body: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-card border border-line bg-raised ${className}`}
    >
      <div className="relative z-10 p-7 pb-0 md:p-8 md:pb-0">
        <h3 className="max-w-[22ch] text-[24px] font-light leading-[30px] tracking-[-0.6px] text-ink md:text-[26px] md:leading-[32px]">
          {title}
        </h3>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-[23px] text-ink-2">{body}</p>
      </div>
      <div className="relative mt-8 flex flex-1 items-end px-5 pb-0 md:px-8">{children}</div>
    </article>
  );
}

/** Mini UI shell: the product's own surface, sitting on the card's wash. */
function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative z-10 w-full rounded-t-[14px] border border-b-0 border-line bg-raised p-4 shadow-lift-2 md:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function Discovery() {
  const t = useTranslations('landing');
  return (
    <Panel>
      <p className="text-[11px] font-medium text-muted">{t('pDiscOriginal')}</p>
      <p className="mt-1 text-[13px] leading-[19px] text-muted line-through decoration-line-strong">
        {t('pDiscOriginalTitle')}
      </p>
      <p className="mt-4 text-[11px] font-medium text-indigo-text">{t('pDiscSimple')}</p>
      <p className="mt-1 text-[17px] font-medium tracking-[-0.2px] text-ink">{t('pDiscSimpleTitle')}</p>
      <div className="mt-4 flex flex-wrap gap-1.5 pb-1">
        {['CPV 45214200-2', 'Brașov', 'RON 2M-5M', t('pDiscOpen')].map((c) => (
          <span key={c} className="rounded-pill border border-line bg-sunk px-2.5 py-1 font-mono text-[11px] text-ink-2">
            {c}
          </span>
        ))}
      </div>
    </Panel>
  );
}

function Eligibility() {
  const t = useTranslations('landing');
  const rows = [
    { k: 'pEligTurnover', need: 'RON 6,000,000', have: 'RON 15,200,000', ok: true },
    { k: 'pEligSimilar', need: t('pEligSimilarNeed'), have: t('pEligSimilarHave'), ok: true },
    { k: 'pEligIso', need: 'ISO 9001', have: t('pEligOnFile'), ok: true },
    { k: 'pEligGuarantee', need: 'RON 38,400', have: '', ok: null },
  ] as const;
  return (
    <Panel>
      <div className="grid grid-cols-[1fr_auto] gap-x-4 text-[11px] font-medium text-muted md:grid-cols-[1.3fr_1fr_1fr_auto]">
        <span>{t('pEligReq')}</span>
        <span className="hidden md:block">{t('pEligNeed')}</span>
        <span className="hidden md:block">{t('pEligYours')}</span>
        <span className="text-right">{t('pEligResult')}</span>
      </div>
      <ul className="mt-2 divide-y divide-line">
        {rows.map((r) => (
          <li
            key={r.k}
            className="grid grid-cols-[1fr_auto] items-center gap-x-4 py-2.5 text-[13px] md:grid-cols-[1.3fr_1fr_1fr_auto]"
          >
            <span className="text-ink">{t(r.k)}</span>
            <span className="hidden font-mono text-[12px] text-ink-2 md:block">{r.need}</span>
            <span className="hidden font-mono text-[12px] text-ink-2 md:block">{r.have || '-'}</span>
            <span
              className={`justify-self-end rounded-pill px-2 py-0.5 text-[11px] font-semibold ${
                r.ok ? 'bg-eligible-bg text-eligible' : 'bg-warn-bg text-warn'
              }`}
            >
              {r.ok ? t('pEligMet') : t('pEligUnverified')}
            </span>
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-1.5 border-t border-line pb-1 pt-3 text-[12px] text-muted">
        <Icon name="document_scanner" size="xs" />
        {t('pEligOcr')}
      </p>
    </Panel>
  );
}

function Generator() {
  const t = useTranslations('landing');
  const agents = [
    { name: t('pGenSpec'), done: true },
    { name: t('pGenElig'), done: true },
    { name: t('pGenLegal'), done: true },
    { name: t('pGenWriter'), done: false },
    { name: t('pGenRisk'), done: false },
  ];
  return (
    <Panel className="grid gap-5 md:grid-cols-[1fr_1.25fr]">
      <ul className="grid content-start gap-2">
        {agents.map((a) => (
          <li key={a.name} className="flex items-center gap-2.5 text-[13px]">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[12px] ${
                a.done ? 'bg-indigo text-on-indigo' : 'border border-line-strong text-muted'
              }`}
            >
              {a.done ? '✓' : ''}
            </span>
            <span className={a.done ? 'text-ink' : 'text-muted'}>{a.name}</span>
          </li>
        ))}
      </ul>
      <div className="rounded-field border border-line bg-paper p-4 pb-2">
        <p className="text-[13px] font-semibold text-ink">{t('pGenDoc')}</p>
        {[
          { h: t('pGenSec1'), by: t('pGenSpec') },
          { h: t('pGenSec2'), by: t('pGenWriter') },
          { h: t('pGenSec3'), by: t('pGenLegal') },
        ].map((s) => (
          <div key={s.h} className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-ink-2">{s.h}</span>
              <span className="shrink-0 rounded-pill bg-indigo-soft px-2 py-0.5 text-[10px] font-medium text-indigo-text">
                {s.by}
              </span>
            </div>
            <div className="mt-1.5 grid gap-1">
              <span className="h-1.5 w-full rounded-full bg-sunk" />
              <span className="h-1.5 w-4/5 rounded-full bg-sunk" />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Market() {
  const t = useTranslations('landing');
  const lang = useLocale() === 'ro' ? 'ro' : 'en';
  const winners = [
    { name: 'Carpați Construct SRL', n: 4 },
    { name: 'Drumuri Sud SA', n: 2 },
    { name: 'Edil Brașov SRL', n: 1 },
  ];
  const years = [
    { y: '2021', past: true },
    { y: '2023', past: true },
    { y: '2025', past: true },
    { y: lang === 'ro' ? 'mar. 2027' : 'Mar 2027', past: false },
  ];
  return (
    <Panel>
      <p className="text-[11px] font-medium text-muted">{t('pMktWinners')}</p>
      <ul className="mt-2 grid gap-2">
        {winners.map((w) => (
          <li key={w.name} className="grid grid-cols-[1fr_auto] items-center gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-3">
              <span className="truncate text-ink">{w.name}</span>
              <span className="h-1.5 shrink-0 rounded-full bg-indigo" style={{ width: `${w.n * 22}px` }} />
            </span>
            <span className="font-mono text-[12px] text-ink-2">
              {w.n} {t('pMktContracts')}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[11px] font-medium text-muted">{t('pMktRenewal')}</p>
      <ol className="mt-2 flex items-center pb-1">
        {years.map((y, i) => (
          <li key={y.y} className="flex flex-1 items-center last:flex-none">
            <span
              className={`whitespace-nowrap rounded-pill px-2 py-0.5 font-mono text-[11px] ${
                y.past ? 'bg-sunk text-ink-2' : 'bg-indigo text-on-indigo'
              }`}
            >
              {y.y}
            </span>
            {i < years.length - 1 && (
              <span className={`mx-1.5 h-px flex-1 ${i === years.length - 2 ? 'border-t border-dashed border-indigo' : 'bg-line-strong'}`} />
            )}
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/** What Lichit does, as four product views on a varied bento grid. */
export function ProductBento() {
  const t = useTranslations('landing');
  return (
    <section id="features" className="mx-auto max-w-[1200px] scroll-mt-20 px-4 py-16 md:px-8 md:py-24">
      <h2 className="max-w-[760px] text-[32px] font-light leading-[1.15] tracking-[-1px] text-ink md:text-[44px] md:leading-[50px] md:tracking-[-1.3px]">
        {t('productTitleA')} <span className="text-muted">{t('productTitleB')}</span>
      </h2>
      <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card title={t('pDiscTitle')} body={t('pDiscBody')} className="lg:col-span-5">
          <Wash from="--ribbon-1" to="--ribbon-2" className="-bottom-24 -left-24 h-56 w-[130%] -rotate-[8deg] opacity-90" />
          <Discovery />
        </Card>
        <Card title={t('pEligTitle')} body={t('pEligBody')} className="lg:col-span-7">
          <Wash from="--ribbon-2" to="--ribbon-3" className="-bottom-28 -right-24 h-60 w-[120%] rotate-[10deg] opacity-90" />
          <Eligibility />
        </Card>
        <Card title={t('pGenTitle')} body={t('pGenBody')} className="lg:col-span-7">
          <Wash from="--ribbon-3" to="--ribbon-4" className="-bottom-24 -left-28 h-56 w-[125%] -rotate-[6deg] opacity-90" />
          <Generator />
        </Card>
        <Card title={t('pMktTitle')} body={t('pMktBody')} className="lg:col-span-5">
          <Wash from="--ribbon-1" to="--ribbon-4" className="-bottom-28 -right-20 h-60 w-[130%] rotate-[9deg] opacity-80" />
          <Market />
        </Card>
      </div>
      <p className="mt-4 text-[12px] text-muted">{t('productExample')}</p>
    </section>
  );
}
