import { ImageResponse } from 'next/og';
import { toLang } from '@/lib/seo';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Licits';

const TAGLINE = {
  en: 'Win the public construction tenders you have been missing.',
  ro: 'Câștigă licitațiile publice de construcții pe care le-ai ratat.',
} as const;

/** Social preview: the wordmark, the promise and the gold dot, in the brand colours. */
export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const lang = toLang((await params).locale);
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#f6f5f0',
          padding: 80,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 64 }}>
            <div style={{ width: 12, height: 64, borderRadius: 6, background: '#0f1f1a' }} />
            <div style={{ position: 'relative', width: 12, height: 40, borderRadius: 6, background: '#0f1f1a', display: 'flex' }}>
              <div style={{ position: 'absolute', top: -22, left: -1, width: 14, height: 14, borderRadius: 7, background: '#d4a72c' }} />
            </div>
          </div>
          <div style={{ fontSize: 64, fontWeight: 700, color: '#0f1f1a', letterSpacing: -2 }}>Licits</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 300, color: '#0f1f1a', lineHeight: 1.08, letterSpacing: -2, maxWidth: 980 }}>
            {TAGLINE[lang]}
          </div>
          <div style={{ display: 'flex', height: 8, width: 240, borderRadius: 4, background: 'linear-gradient(90deg,#0f5c45,#4f9a76,#e2b23c)' }} />
        </div>
      </div>
    ),
    size,
  );
}
