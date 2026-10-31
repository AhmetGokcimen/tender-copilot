import { Link } from '@/i18n/routing';
import { CONTACT_EMAIL } from '@/lib/contact-config';
import type { LegalDoc } from '@/lib/legal';
import { SITE } from '@/lib/site';
import type { Lang } from '@/lib/seo';
import { SitePage } from './SitePage';

const LABELS = {
  en: { updated: 'Last updated', contents: 'Contents', what: 'What', why: 'Why', basis: 'Legal basis', keep: 'How long', operator: 'Operator', email: 'Email', contact: 'Contact page' },
  ro: { updated: 'Ultima actualizare', contents: 'Cuprins', what: 'Ce', why: 'De ce', basis: 'Temei legal', keep: 'Cât timp', operator: 'Operator', email: 'Email', contact: 'Pagina de contact' },
} as const;

const P = 'text-[15px] leading-[25px] text-ink-2';

/** A privacy notice or terms page: contents, numbered sections, data cards, contact block. */
export function LegalDocument({ doc, lang }: { doc: LegalDoc; lang: Lang }) {
  const L = LABELS[lang];
  const date = new Intl.DateTimeFormat(lang === 'ro' ? 'ro-RO' : 'en-GB', { dateStyle: 'long' }).format(new Date(doc.updated));
  const { name, registration, address } = SITE.legal;
  const operator = [name, registration, address].filter(Boolean);
  return (
    <SitePage>
      <article className="flex flex-col gap-10">
        <header className="flex flex-col gap-4">
          <h1 className="max-w-2xl text-[36px] font-light leading-[1.1] tracking-[-1.2px] text-ink md:text-[48px] md:leading-[52px] md:tracking-[-1.6px]">
            {doc.title}
          </h1>
          <p className="font-mono text-[12px] text-muted">
            {L.updated} <time dateTime={doc.updated}>{date}</time>
          </p>
          <p className="max-w-[62ch] text-[17px] leading-[27px] text-ink-2">{doc.intro}</p>
        </header>

        <nav aria-label={L.contents} className="rounded-card border border-line bg-raised p-5 md:p-6">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{L.contents}</p>
          <ol className="mt-3 grid gap-x-8 gap-y-1.5 text-[14px] md:grid-cols-2">
            {doc.sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-indigo-text underline-offset-4 hover:underline">
                  {i + 1}. {s.h}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {doc.sections.map((s, i) => (
          <section key={s.id} id={s.id} className="flex scroll-mt-24 flex-col gap-4">
            <h2 className="text-[24px] font-light leading-[30px] tracking-[-0.6px] text-ink md:text-[28px] md:leading-[34px]">
              {i + 1}. {s.h}
            </h2>
            {s.p?.map((p) => (
              <p key={p} className={P}>
                {p}
              </p>
            ))}
            {s.id === 'operator' && operator.length > 0 && (
              <p className="rounded-card border border-line bg-raised p-4 text-[15px] leading-[24px] text-ink">
                <span className="font-mono text-[12px] text-muted">{L.operator}</span>
                <br />
                {operator.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </p>
            )}
            {s.rows && (
              <ul className="flex flex-col gap-3">
                {s.rows.map((r) => (
                  <li key={r.t} className="rounded-card border border-line bg-raised p-5">
                    <h3 className="text-[16px] font-medium text-ink">{r.t}</h3>
                    <dl className="mt-3 grid gap-x-4 gap-y-2 text-[14px] leading-[22px] sm:grid-cols-[110px_1fr]">
                      {(
                        [
                          [L.what, r.d],
                          [L.why, r.w],
                          [L.basis, r.b],
                          [L.keep, r.k],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k} className="contents">
                          <dt className="font-mono text-[12px] text-muted sm:pt-0.5">{k}</dt>
                          <dd className="text-ink-2">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
            )}
            {s.list && (
              <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-indigo">
                {s.list.map((i2) => (
                  <li key={i2} className={P}>
                    {i2}
                  </li>
                ))}
              </ul>
            )}
            {s.p2?.map((p) => (
              <p key={p} className={P}>
                {p}
              </p>
            ))}
            {s.id === 'contact' && (
              <p className="rounded-card border border-line bg-raised p-4 text-[15px] leading-[24px] text-ink">
                {L.email}:{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-indigo-text hover:underline">
                  {CONTACT_EMAIL}
                </a>
                <br />
                <Link href="/contact" className="font-medium text-indigo-text hover:underline">
                  {L.contact}
                </Link>
              </p>
            )}
          </section>
        ))}
      </article>
    </SitePage>
  );
}
