import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Icon } from '../Icon';

const POINTS = [
  { icon: 'tune', key: 'asst1' },
  { icon: 'lock', key: 'asst2' },
  { icon: 'link', key: 'asst3' },
] as const;

/** One tender line in the example reply: plain title, data in mono, a match chip. */
function Row({ title, meta, score }: { title: string; meta: string; score: number }) {
  const t = useTranslations('landing');
  return (
    <li className="flex flex-col gap-1.5 rounded-field border border-line bg-surface px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[15px] font-medium leading-[21px] tracking-[-0.1px] text-ink">{title}</p>
        <span className="tnum inline-flex shrink-0 items-center gap-1 rounded-pill bg-eligible-bg px-2 py-0.5 text-[12px] font-medium text-eligible">
          <Icon name="check_circle" size="xs" />
          {t('asstMatch', { score })}
        </span>
      </div>
      <p className="font-mono text-[12px] leading-[18px] text-muted">{meta}</p>
    </li>
  );
}

/**
 * Landing section for the AI-assistant connection (MCP). Left: what it is and
 * why it is safe. Right: an example exchange, labelled as an example, in the
 * same panel language as the product bento.
 */
export function AssistantConnect() {
  const t = useTranslations('landing');
  return (
    <section id="assistant" className="mx-auto max-w-[1200px] scroll-mt-20 px-4 py-16 md:px-8 md:py-24">
      <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div>
          <p className="text-[14px] font-medium text-indigo-text">{t('asstEyebrow')}</p>
          <h2 className="mt-3 max-w-[560px] text-[32px] font-light leading-[1.15] tracking-[-1px] text-ink md:text-[44px] md:leading-[50px] md:tracking-[-1.3px]">
            {t('asstTitle')}
          </h2>
          <p className="mt-4 max-w-[56ch] text-[17px] leading-[27px] text-ink-2 md:text-[19px] md:leading-[29px]">
            {t('asstSub')}
          </p>
          <ul className="mt-8 grid gap-5">
            {POINTS.map(({ icon, key }) => (
              <li key={key} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-indigo-soft text-indigo-text">
                  <Icon name={icon} size="md" />
                </span>
                <div>
                  <h3 className="text-[17px] font-medium tracking-[-0.2px] text-ink">{t(`${key}Title`)}</h3>
                  <p className="mt-1 max-w-[52ch] text-[15px] leading-[23px] text-ink-2">{t(`${key}Body`)}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href="/docs/mcp"
              className="text-[15px] font-medium text-indigo-text underline-offset-4 hover:underline"
            >
              {t('asstLink')}
            </Link>
            <span className="text-[13px] text-muted">{t('asstWorks')}</span>
          </div>
        </div>

        <div
          role="img"
          aria-label={t('asstExample')}
          className="relative rounded-card border border-line bg-raised p-4 shadow-lift-2 md:p-6"
        >
          <p className="absolute right-4 top-4 text-[11px] font-medium text-muted md:right-6 md:top-5">
            {t('asstExample')}
          </p>
          <div className="flex flex-col gap-4 pt-4">
            <p className="ml-auto max-w-[88%] rounded-[14px] rounded-br-[4px] bg-sunk px-4 py-3 text-[15px] leading-[22px] text-ink">
              {t('asstUser')}
            </p>
            <p className="inline-flex w-fit items-center gap-1.5 rounded-pill bg-indigo-soft px-2.5 py-1 font-mono text-[11.5px] text-indigo-text">
              <Icon name="bolt" size="xs" />
              {t('asstTool')}
            </p>
            <div className="flex flex-col gap-3">
              <p className="text-[15px] leading-[22px] text-ink">{t('asstReply')}</p>
              <ul className="grid gap-2.5">
                <Row title={t('asstRow1')} meta={t('asstMeta1')} score={86} />
                <Row title={t('asstRow2')} meta={t('asstMeta2')} score={78} />
              </ul>
              <p className="text-[14px] leading-[21px] text-ink-2">{t('asstClosing')}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
