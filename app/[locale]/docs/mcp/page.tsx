import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { JsonLd } from '@/components/seo/JsonLd';
import { SitePage } from '@/components/landing/SitePage';
import { webPage } from '@/lib/schema';
import { PAGE_META, pageMetadata, toLang } from '@/lib/seo';

const MCP_URL = 'https://licits.com/api/mcp';

const TOOLS = [
  'get_my_filters',
  'recommend_tenders',
  'search_tenders',
  'get_tender',
  'upcoming_deadlines',
  'my_pipeline',
] as const;

const PLANS = [
  { name: 'Start', calls: '100' },
  { name: 'Growth', calls: '1,000' },
  { name: 'Pro', calls: '5,000' },
] as const;

const CLAUDE_CODE = `claude mcp add --transport http licits ${MCP_URL} \\
  --header "Authorization: Bearer YOUR_API_KEY"`;

const CURSOR = JSON.stringify(
  { mcpServers: { licits: { url: MCP_URL, headers: { Authorization: 'Bearer YOUR_API_KEY' } } } },
  null,
  2,
);

const CURL = `curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "https://licits.com/api/v1/tenders?cpv=45&min_days_left=14&limit=5"`;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, '/docs/mcp');
}

const H2 = 'text-[26px] font-light leading-[32px] tracking-[-0.7px] text-ink md:text-[32px] md:leading-[38px]';
const BODY = 'text-[15px] leading-[23px] text-ink-2';

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-field border border-line bg-sunk p-4 font-mono text-[13px] leading-[20px] text-ink">
      <code>{children}</code>
    </pre>
  );
}

export default async function McpDocsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('mcpDocs');
  const meta = PAGE_META['/docs/mcp'][toLang(locale)];
  return (
    <SitePage wide>
      <JsonLd data={webPage(toLang(locale), 'WebPage', '/docs/mcp', meta.title, meta.description)} />
      <p className="text-[14px] font-medium text-indigo-text">{t('eyebrow')}</p>
      <h1 className="mt-3 text-[36px] font-light leading-[1.1] tracking-[-1.2px] text-ink md:text-[48px] md:leading-[52px] md:tracking-[-1.6px]">
        {t('title')}
      </h1>
      <p className="mt-4 max-w-[62ch] text-[17px] leading-[27px] text-ink-2 md:text-[19px] md:leading-[29px]">{t('lead')}</p>

      <div className="mt-8 rounded-card border border-line bg-raised p-5">
        <p className="text-[12px] font-medium text-muted">{t('address')}</p>
        <p className="tnum mt-1 break-all font-mono text-[15px] text-ink">{MCP_URL}</p>
      </div>

      <section className="mt-14 grid gap-5" aria-labelledby="connect">
        <h2 id="connect" className={H2}>
          {t('connectTitle')}
        </h2>
        <h3 className="text-[18px] font-medium text-ink">{t('claudeTitle')}</h3>
        <ol className="grid gap-2 pl-5 [list-style:decimal]">
          {(['claude1', 'claude2', 'claude3', 'claude4'] as const).map((k) => (
            <li key={k} className={BODY}>
              {t(k)}
            </li>
          ))}
        </ol>
        <h3 className="mt-2 text-[18px] font-medium text-ink">{t('gptTitle')}</h3>
        <p className={BODY}>{t('gptBody')}</p>
        <h3 className="mt-2 text-[18px] font-medium text-ink">{t('keyTitle')}</h3>
        <p className={BODY}>{t('keyBody')}</p>
        <Code>{CLAUDE_CODE}</Code>
        <Code>{CURSOR}</Code>
      </section>

      <section className="mt-14 grid gap-5" aria-labelledby="tools">
        <h2 id="tools" className={H2}>
          {t('toolsTitle')}
        </h2>
        <div className="overflow-x-auto rounded-card border border-line bg-raised">
          <table className="w-full min-w-[520px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b border-line bg-sunk text-[12px] font-medium text-muted">
                <th className="px-4 py-2.5">{t('toolName')}</th>
                <th className="px-4 py-2.5">{t('toolDoes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {TOOLS.map((name) => (
                <tr key={name}>
                  <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[13px] text-ink">{name}</td>
                  <td className="px-4 py-3 text-ink-2">{t(`tool_${name}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-14 grid gap-5" aria-labelledby="prompts">
        <h2 id="prompts" className={H2}>
          {t('promptsTitle')}
        </h2>
        <ul className="grid gap-2.5">
          {(['prompt1', 'prompt2', 'prompt3', 'prompt4'] as const).map((k) => (
            <li key={k} className="rounded-field border border-line bg-raised px-4 py-3 text-[15px] leading-[22px] text-ink">
              {t(k)}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14 grid gap-5" aria-labelledby="limits">
        <h2 id="limits" className={H2}>
          {t('limitsTitle')}
        </h2>
        <p className={BODY}>{t('limitsBody')}</p>
        <div className="overflow-x-auto rounded-card border border-line bg-raised">
          <table className="w-full border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b border-line bg-sunk text-[12px] font-medium text-muted">
                <th className="px-4 py-2.5">{t('planCol')}</th>
                <th className="px-4 py-2.5">{t('callsCol')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {PLANS.map((p) => (
                <tr key={p.name}>
                  <td className="px-4 py-3 text-ink">{p.name}</td>
                  <td className="tnum px-4 py-3 font-mono text-ink-2">{p.calls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-14 grid gap-5" aria-labelledby="safety">
        <h2 id="safety" className={H2}>
          {t('safetyTitle')}
        </h2>
        <ul className="grid gap-2.5">
          {(['safety1', 'safety2', 'safety3', 'safety4'] as const).map((k) => (
            <li key={k} className="flex gap-2.5 text-[15px] leading-[23px] text-ink-2">
              <span aria-hidden className="text-eligible">
                ✓
              </span>
              <span>{t(k)}</span>
            </li>
          ))}
        </ul>
        <Link href="/privacy#connectors" className="w-fit text-[15px] font-medium text-indigo-text underline-offset-4 hover:underline">
          {t('safetyLink')}
        </Link>
      </section>

      <section className="mt-14 grid gap-5" aria-labelledby="api">
        <h2 id="api" className={H2}>
          {t('apiTitle')}
        </h2>
        <p className={BODY}>{t('apiBody')}</p>
        <Code>{CURL}</Code>
      </section>

      <section className="mt-14 grid gap-3" aria-labelledby="support">
        <h2 id="support" className={H2}>
          {t('supportTitle')}
        </h2>
        <p className={BODY}>{t('supportBody')}</p>
        <Link href="/contact" className="w-fit text-[15px] font-medium text-indigo-text underline-offset-4 hover:underline">
          {t('supportLink')}
        </Link>
      </section>
    </SitePage>
  );
}
